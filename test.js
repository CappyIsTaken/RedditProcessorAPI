import { PutObjectAclCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import axios from "axios"
import axiosRetry from "axios-retry"
import { config } from "dotenv"
import fs from "fs"


config()


const client = axios.create()



axiosRetry(client, {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay
})


async function getFileUploadInfo(fileSize) {
    const fileInfoResp = await client.get(`https://ajax.streamable.com/api/v1/uploads/shortcode?size=${fileSize}&version=unknown`)
    return fileInfoResp.data
    
}





export async function uploadFile(filePath) {
    try {
        const fileSize = fs.statSync(filePath).size
        const {bucket, key, credentials, transcoder_options} = await getFileUploadInfo(fileSize)
        const s3Client = new S3Client({
            credentials,
            region: "us-east-1"
        })
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fs.createReadStream(filePath),
            ACL: "public-read"
        })
        const fileUploadResp = await s3Client.send(command)
        if(fileUploadResp.$metadata.httpStatusCode === 200) {
            return transcoder_options.url
        }
    }
    catch(e) {
        console.log(e)
    }
    
}

