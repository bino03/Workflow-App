import type { FastifyInstance } from 'fastify';
import { parseWith } from '../common/validation.js';
import { projectPathQuerySchema, putProjectInfoSchema, registerDeploySchema, removeDeployQuerySchema } from './projectInfo.schemas.js';
import type { ProjectInfoService } from './projectInfoService.js';

export type ProjectInfoRoutesOptions = {
  projectInfoService: ProjectInfoService;
};

/** The per-project sheet (ADR 0028, spec informacao-dos-projetos §4.2). Session required, like every /api route. */
export async function projectInfoRoutes(app: FastifyInstance, { projectInfoService }: ProjectInfoRoutesOptions): Promise<void> {
  app.get('/api/project-infos', async () => projectInfoService.list());

  app.put('/api/project-infos', async (request) => {
    const { projectPath, info } = parseWith(putProjectInfoSchema, request.body);
    return projectInfoService.save(projectPath, info);
  });

  app.delete('/api/project-infos', async (request, reply) => {
    const { projectPath } = parseWith(projectPathQuerySchema, request.query);
    await projectInfoService.remove(projectPath);
    return reply.status(204).send();
  });

  app.post('/api/project-infos/deploys', async (request) => {
    const { projectPath, environmentId, ...deploy } = parseWith(registerDeploySchema, request.body);
    return projectInfoService.registerDeploy(projectPath, environmentId, deploy);
  });

  app.delete('/api/project-infos/deploys', async (request) => {
    const { projectPath, environmentId, deployId } = parseWith(removeDeployQuerySchema, request.query);
    return projectInfoService.removeDeploy(projectPath, environmentId, deployId);
  });
}
