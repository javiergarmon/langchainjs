import { BaseCache } from "../schema/index.js";
import { getCacheKey } from "./base.js";
/**
 * Cache LLM results using Redis.
 */
export class RedisCache extends BaseCache {
    constructor(redisClient) {
        super();
        Object.defineProperty(this, "redisClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.redisClient = redisClient;
    }
    /**
     * Retrieves data from the Redis server using a prompt and an LLM key. If
     * the data is not found, it returns null.
     * @param prompt The prompt used to find the data.
     * @param llmKey The LLM key used to find the data.
     * @returns The corresponding data as an array of Generation objects, or null if not found.
     */
    async lookup(prompt, llmKey) {
        let idx = 0;
        let key = getCacheKey(prompt, llmKey, String(idx));
        let value = await this.redisClient.get(key);
        const generations = [];
        while (value) {
            if (!value) {
                break;
            }
            generations.push({ text: value });
            idx += 1;
            key = getCacheKey(prompt, llmKey, String(idx));
            value = await this.redisClient.get(key);
        }
        return generations.length > 0 ? generations : null;
    }
    /**
     * Updates the data in the Redis server using a prompt and an LLM key.
     * @param prompt The prompt used to store the data.
     * @param llmKey The LLM key used to store the data.
     * @param value The data to be stored, represented as an array of Generation objects.
     */
    async update(prompt, llmKey, value) {
        for (let i = 0; i < value.length; i += 1) {
            const key = getCacheKey(prompt, llmKey, String(i));
            await this.redisClient.set(key, value[i].text);
        }
    }
}
