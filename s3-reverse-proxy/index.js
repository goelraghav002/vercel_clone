const express = require('express');
const httpProxy = require('http-proxy');
const dotenv = require('dotenv');

const app = express();
const PORT = process.env.PORT || 8000;
const BASE_URL = 'https://vercel-outputs-clone.s3.ap-south-1.amazonaws.com/__outputs';

dotenv.config()

const proxy = httpProxy.createProxy();

app.use((req, res) => {
  const hostname = req.hostname;
  const subDomain = hostname.split('.')[0];

  const resolvesTo = `${BASE_URL}/${subDomain}`

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
  const url = req.url;
  if (url === '/')
    proxyReq.path += 'index.html';
  return proxyReq;
})

app.listen(PORT, () => {
  console.log(`Reverse proxy server is running on port ${PORT}`);
})