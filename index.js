import express from "express"
import cors from "cors"
import axios from "axios"
import pathToFFmpeg from "ffmpeg-static"
import {exec} from "child_process"
import util from "util"
import retry from "axios-retry"
import fs from "fs"
import {config} from "dotenv"

import FormData from "form-data"

const app = express();
const PORT = 3000

config()


const execPromise = util.promisify(exec)


retry(axios, {
    retries: 5,
    retryDelay: retry.exponentialDelay
})

app.use(cors())

async function uploadFile(filePath) {
    const stream = fs.createReadStream(filePath)
    const serverGetResponse = await axios.get("https://api.gofile.io/getServer")
    const serverUrl = `https://${serverGetResponse.data.data.server}.gofile.io/uploadFile`
    const form = new FormData()
    form.append("token", process.env.TOKEN)
    form.append("folderId", "9ee09383-47da-4fcd-8531-dac6181c0876")
    form.append("file", stream)
    const uploadFileResponse = await axios.post(serverUrl, form, {
        headers: form.getHeaders()
    })
    return uploadFileResponse.status === 200
}

async function getFileDownloadLink(fileName) {
    const folderGetResponse = await axios.get(`https://api.gofile.io/getContent?contentId=9ee09383-47da-4fcd-8531-dac6181c0876&token=${process.env.TOKEN}&websiteToken=12345&cache=true`)
    const {data} = folderGetResponse
    const file = Object.values(data.data.contents).find(f => f.name === fileName)
    if(file) return file.link
    return null
}


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
        await execPromise(`${pathToFFmpeg} -i ${videoUrl} -i ${audioUrl}  -c:v copy -c:a aac tmp/${post.name}.mp4`)
        const hasUploaded = await uploadFile(`tmp/${post.name}.mp4`)
        if(hasUploaded) {
            fs.unlinkSync(`tmp/${post.name}.mp4`)
            return res.send({
                "url": `/videos/${post.name}.mp4`
            })
        }
    }

})



app.listen(PORT, () => {
    console.log(`The server is active at: http://localhost:${PORT}`)
})