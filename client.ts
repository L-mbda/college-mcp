import OpenAI from 'openai'
require('@dotenvx/dotenvx').config();


export const client = new OpenAI({'baseURL': process.env.PROVIDER_BASE_URL, 'apiKey': process.env.PROVIDER_API_KEY});
export const model = process.env.PROVIDER_AI_MODEL;