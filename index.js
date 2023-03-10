import express from "express"
import cors from "cors"
import axios from "axios"
import pathToFFmpeg from "ffmpeg-static"
import {exec} from "child_process"
import util from "util"
import retry from "axios-retry"
import fs from "fs"
import {config} from "dotenv"
import { uploadFile } from "./test.js"


const app = express();
const PORT = 3000

config()





const execPromise = util.promisify(exec)


retry(axios, {
    retries: 5,
    retryDelay: retry.exponentialDelay
})

app.use(cors())









app.get("/videos/:id", async (req, res) => {
    const {id} = req.params
    const fileDownloadResp = await axios.get(await getFileDownloadLink(id), {
        responseType: "stream",
        headers: {
            "Cookie": "accountToken="+process.env.TOKEN
        }
    })
    fileDownloadResp.data.pipe(res)
})


app.get("/reddit", async (req, res) => {
    const {url} = req.query
    if(!url || !url.includes("https://www.reddit.com/r/")) return res.send("Not a valid reddit url!")
    
    const postResponse = await axios.get(`${url}/.json`)
    const {data} = postResponse
    const post = data[0].data.children[0].data
    if(post.media) {
        const videoUrl = post.media.reddit_video.fallback_url
        const audioUrl = videoUrl.replace(videoUrl.substring(videoUrl.lastIndexOf("_")+1, videoUrl.lastIndexOf(".")), "audio")
        await execPromise(`${pathToFFmpeg} -i ${videoUrl} -i ${audioUrl}  -c:v copy -c:a aac -y tmp/${post.name}.mp4`)
        const url = await uploadFile(`tmp/${post.name}.mp4`)
        fs.unlinkSync(`tmp/${post.name}.mp4`)
        res.send({fileURL: url})
    }
    else {
        res.status(404).send("Not a valid twitter video!")
    }
})



app.listen(PORT, () => {
    console.log(`The server is active at: http://localhost:${PORT}`)
})