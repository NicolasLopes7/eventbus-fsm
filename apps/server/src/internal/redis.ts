import Redis from "ioredis";
import { config } from "../config";

export const pub = new Redis(config.redisURL);
export const sub = new Redis(config.redisURL);


export const emit = async (event: Record<string, unknown>) => {
  const seq = await pub.incr(`call:${event.id}`)
  const eventString = JSON.stringify({ ...event, seq })
  await pub.xadd(`stream:call:${event.id}`, '*', "json", eventString)
  await pub.publish(`pub:call:${event.id}`, eventString)
}