import licenseWorker from '../../../server/license/worker.js';

export const onRequest = ({ request, env }) => licenseWorker.fetch(request, env);
