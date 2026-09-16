export const DEFAULT_MIC_ID = 'default';
export const MICROPHONE_TIMEOUT_MS = 15000;

export function preferredMicrophoneId(devices) {
    return devices.find(device => device.kind === 'audioinput' && device.deviceId &&
        device.deviceId !== DEFAULT_MIC_ID && /airpods/i.test(device.label))?.deviceId || DEFAULT_MIC_ID;
}

export function microphoneSupportError() {
    if (!window.isSecureContext) return 'Microphone access requires HTTPS or localhost. Open this page on localhost or through HTTPS.';
    if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot access microphones. Open this page in a browser with microphone support.';
    return '';
}

export function microphoneErrorMessage(error) {
    switch (error.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Microphone access is blocked. Allow it in this site’s browser permissions and in your system privacy settings, then try again.';
        case 'NotFoundError':
            return 'No microphone is available. Connect or enable an input device in your system sound settings, then try again.';
        case 'NotReadableError':
        case 'AbortError':
            return 'The microphone could not start. Check your system input device, close other apps using it, then try again.';
        case 'OverconstrainedError':
            return 'The selected microphone is unavailable. Select System default and try again.';
        case 'TimeoutError':
            return 'The browser did not open the microphone within 15 seconds. Check microphone access for this site and for your browser in system privacy settings. If access is already allowed, restart the browser and try again.';
        default:
            return error.message || 'Microphone access failed. Check your browser and system microphone settings, then try again.';
    }
}

export async function openMicrophone(deviceId = DEFAULT_MIC_ID, { signal, timeoutMs = MICROPHONE_TIMEOUT_MS } = {}) {
    const unsupported = microphoneSupportError();
    if (unsupported) throw new Error(unsupported);
    if (signal?.aborted) throw new DOMException('Microphone request cancelled.', 'AbortError');
    if (timeoutMs <= 0) throw new DOMException('Microphone request timed out.', 'TimeoutError');
    const audio = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const specificDevice = deviceId && deviceId !== DEFAULT_MIC_ID;
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error, result) => {
            if (settled) {
                // getUserMedia cannot be aborted. Release any late permission grant.
                result?.stream.getTracks().forEach(track => track.stop());
                return;
            }
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            if (error) reject(error);
            else resolve(result);
        };
        const onAbort = () => finish(new DOMException('Microphone request cancelled.', 'AbortError'));
        const timer = setTimeout(() => finish(new DOMException('Microphone request timed out.', 'TimeoutError')), timeoutMs);
        signal?.addEventListener('abort', onAbort, { once: true });
        const acquire = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: specificDevice ? { ...audio, deviceId: { exact: deviceId } } : audio,
                });
                return { stream, usedDefault: !specificDevice };
            } catch (error) {
                if (settled || !specificDevice || !['NotFoundError', 'OverconstrainedError'].includes(error.name)) throw error;
                // A disconnected input can use the default within the same deadline.
                const stream = await navigator.mediaDevices.getUserMedia({ audio });
                return { stream, usedDefault: true };
            }
        };
        acquire().then(result => finish(null, result), error => finish(error));
    });
}
