// PM2 process file: pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'inventory-api',
      script: 'src/server.js',
      instances: 1,
      env_production: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
  ],
};
