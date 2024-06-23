const express = require('express')
const cors = require('cors')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const { Server } = require('socket.io')
const dotenv = require('dotenv')

const Redis = require('ioredis')
const PORT = process.env.PORT || 9000
const SOCKET_PORT = process.env.SOCKET_PORT || 9002
const subscrier = new Redis(process.env.REDIS_URL)


dotenv.config()
const app = express()
const io = new Server({ cors: '*' })

app.use(cors());

io.on('connection', socket => {
  socket.on('subscribe', channel => {
    socket.join(channel)
    socket.emit('message', `Subscribed to ${channel}`)
  })
})

io.listen(SOCKET_PORT,() => {
  console.log(`Socket server is running on port ${SOCKET_PORT}`)
})

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
  }
})

const config = {
  CLUSTER: process.env.CLUSTER,
  TASK: process.env.TASK
}

app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.post('/project', async (req, res) => {
  const { gitURL, slug } = req.body
  const projectSlug = slug ? slug : generateSlug()

  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: 'FARGATE',
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
        subnets: ['subnet-0cf82589bbe6821ce', 'subnet-03cb819f36a6dc99e', 'subnet-0a1d550a3504bb225', 'subnet-0f0539e31ccf1b22f', 'subnet-000e27f3faf22910b', 'subnet-04bfebd7f8893360a'],
        securityGroups: ['sg-05d47a07abcdde238'],
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: 'builder-image',
          environment: [
            { name: 'GIT_REPOSITORY__URL', value: gitURL },
            { name: 'PROJECT_ID', value: projectSlug }
          ]
        }
      ]
    }
  })
  
  await ecsClient.send(command)

  return res.json({ staus: 'queued', data: {projectSlug, url: `http://${projectSlug}.localhost:8000`}})
})

async function initRedisSubscribe() {
  console.log('Subscribed to logs')
  subscrier.psubscribe('logs:*')
  subscrier.on('pmessage', (pattern, channel, message) => {
    io.to(channel).emit('message', message)
  })
}

initRedisSubscribe()

app.listen(PORT, () => {
  console.log(`API server is running on port ${PORT}`)
})