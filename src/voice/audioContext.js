export function resumeAudioContext(context) {
    if (context.state === 'running') return Promise.resolve(context);
    return new Promise((resolve, reject) => {
        const finish = (error) => {
            clearTimeout(timer);
            context.removeEventListener('error', onError);
            if (error) reject(error);
            else resolve(context);
        };
        const onError = () => finish(new Error('The audio device could not start.'));
        const timer = setTimeout(() => finish(new Error('The audio device did not start within five seconds.')), 5000);
        context.addEventListener('error', onError, { once: true });
        try {
            context.resume().then(() => {
                finish(context.state === 'running' ? null : new Error('The audio device is not running.'));
            }, finish);
        } catch (error) {
            finish(error);
        }
    });
}

export async function closeAudioContext(context) {
    if (!context) return;
    context.onerror = null;
    if (context.state !== 'closed') {
        try { await context.close(); } catch { /* It may already be closing. */ }
    }
}
