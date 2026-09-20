import companyWorker from '../server/company/worker.js';

export const routeCompanyRequest = ({ request, env }) => companyWorker.fetch(request, env);
