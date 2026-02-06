
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

export function load() {
    const diskSource = env.DISK_SOURCE;

    if (!diskSource || diskSource.trim() === '') {
        // Enforce STRICT requirement: if not set, crash/error
        console.error('CRITICAL: DISK_SOURCE is missing in .env');
        throw error(500, 'Server configuration error: DISK_SOURCE is missing. Please check .env file.');
    }

    return {
        diskSource
    };
}
