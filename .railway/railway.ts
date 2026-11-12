import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "iad" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "iad", sizeMB: 500 });
  const treinadeskApi = service("treinadesk-api", {
    source: github("wesleygado/treinadesk", { branch: "main", checkSuites: false }),
    build: { buildCommand: "npm run build", buildEnvironment: "V3", builder: "RAILPACK" },
    start: "node dist/main.js",
    healthcheck: "/health",
    healthcheckTimeout: 60,
    preDeploy: "npx prisma migrate deploy && npm run seed",
    replicas: { "iad": 1 },
    env: {
      // Postgres pela rede privada; também é lida no build (prisma generate).
      DATABASE_URL: Postgres.env.DATABASE_URL,
      // Obrigatório: sem ele o seed do pre-deploy cria os usuários de teste.
      NODE_ENV: "production",
      // Segredos e dados pessoais: valor só no Railway, nunca no repositório.
      JWT_ACCESS_SECRET: preserve(),
      ADMIN_EMAIL: preserve(),
      ADMIN_PASSWORD: preserve(),
    },
  });

  return project("treinadesk", {
    variables: { managed: true },
    resources: [Postgres, treinadeskApi, postgresVolume],
  });
});
