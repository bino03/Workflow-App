// The /api/project-infos routes over real HTTP (spec informacao-dos-projetos, step 7) against a running backend:
// the session cookie from a real login, no browser. The unit tests only use `app.inject`; this goes through the
// socket, the cookie plugin, the Origin-less REST path and the compiled error handler.
//
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-info-http.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2] || undefined);
const { check, finish } = checker();
const base = `${instance.base}/api`;
const alfa = instance.projects.Alfa;
let cookie = '';

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, res };
}
const query = (params) => `?${new URLSearchParams(params)}`;

try {
  for (const [method, path] of [['GET', '/project-infos'], ['PUT', '/project-infos'], ['DELETE', '/project-infos'], ['POST', '/project-infos/deploys'], ['DELETE', '/project-infos/deploys']]) {
    const r = await call(method, path);
    check(`${method} ${path} without a session → 401 AUTH_002`, r.status === 401 && r.body?.errorCode === 'AUTH_002', `${r.status} ${r.body?.errorCode}`);
  }

  const login = await call('POST', '/auth/login', { username: instance.username, password: instance.password });
  cookie = (login.res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  check('real login gives a session cookie', login.status === 204 && cookie.startsWith('session='), String(login.status));

  check('GET starts empty', JSON.stringify((await call('GET', '/project-infos')).body) === '[]');

  const put = await call('PUT', '/project-infos', {
    projectPath: alfa,
    info: {
      lifecycle: 'production',
      client: 'Worksite',
      environments: [
        { kind: 'production', name: 'Produção', url: 'https://worksite.example.com', hosting: 'Vercel' },
        { kind: 'staging', name: 'Staging', url: 'https://staging.worksite.example.com' },
      ],
    },
  });
  check('PUT creates the sheet (200) with two environments, each with an id', put.status === 200 && put.body.environments.length === 2 && put.body.environments.every((e) => e.id), String(put.status));
  const [production, staging] = put.body.environments;

  const bad = await call('PUT', '/project-infos', { projectPath: alfa, info: { repoUrl: 'javascript:alert(1)' } });
  check('a javascript: URL → 400 COMMON_001 with the field', bad.status === 400 && bad.body.errorCode === 'COMMON_001' && bad.body.fieldErrors?.some((f) => f.field.includes('repoUrl')), JSON.stringify(bad.body));
  const outside = await call('PUT', '/project-infos', { projectPath: 'C:\\Windows', info: {} });
  check('a path outside the registry → 404 PROJECT_001', outside.status === 404 && outside.body.errorCode === 'PROJECT_001', `${outside.status} ${outside.body?.errorCode}`);

  const first = await call('POST', '/project-infos/deploys', { projectPath: alfa, environmentId: production.id, version: 'v1', note: 'primeiro' });
  const second = await call('POST', '/project-infos/deploys', { projectPath: alfa, environmentId: production.id, at: '2026-01-01T09:00:00.000Z', version: 'v0' });
  check('two deploys register (200)', first.status === 200 && second.status === 200);
  const deploys = second.body.environments[0].deploys;
  check('newest first, "now" for the one without `at`', deploys.length === 2 && deploys[0].version === 'v1' && deploys[1].at === '2026-01-01T09:00:00.000Z', JSON.stringify(deploys.map((d) => [d.version, d.at])));

  const unknownEnv = await call('POST', '/project-infos/deploys', { projectPath: alfa, environmentId: '00000000-0000-4000-8000-000000000000' });
  check('an unknown environment → 404 PROJECT_002', unknownEnv.status === 404 && unknownEnv.body.errorCode === 'PROJECT_002');
  const unknownDeploy = await call('DELETE', `/project-infos/deploys${query({ projectPath: alfa, environmentId: production.id, deployId: '00000000-0000-4000-8000-000000000000' })}`);
  check('an unknown deploy → 404 PROJECT_003', unknownDeploy.status === 404 && unknownDeploy.body.errorCode === 'PROJECT_003');

  const removed = await call('DELETE', `/project-infos/deploys${query({ projectPath: alfa, environmentId: production.id, deployId: deploys[1].id })}`);
  check('DELETE deploy → 200 with one left', removed.status === 200 && removed.body.environments[0].deploys.length === 1);

  // Editing keeps the deploys of the environment that keeps its id, and drops the removed one's.
  const edited = await call('PUT', '/project-infos', { projectPath: alfa, info: { lifecycle: 'maintenance', environments: [{ ...production, deploys: undefined }] } });
  check('PUT keeps the deploys of the surviving environment', edited.status === 200 && edited.body.environments.length === 1 && edited.body.environments[0].deploys.length === 1 && edited.body.lifecycle === 'maintenance', JSON.stringify(edited.body.environments?.map((e) => e.deploys?.length)));
  check('the removed environment (staging) is gone with its data', !edited.body.environments.some((e) => e.id === staging.id));

  const listed = (await call('GET', '/project-infos')).body;
  check('GET lists the sheet', listed.length === 1 && listed[0].projectPath === alfa);

  const del = await call('DELETE', `/project-infos${query({ projectPath: alfa })}`);
  check('DELETE sheet → 204', del.status === 204);
  check('and it is gone', JSON.stringify((await call('GET', '/project-infos')).body) === '[]');
} catch (error) {
  check('scenario ran to the end', false, error.message);
}
process.exit(finish());
