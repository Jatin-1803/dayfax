module.exports = {
  apps: [
    {
      name: 'dayfax-api',
      cwd: '/var/www/dayfax/backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/ubuntu/.pm2/logs/dayfax-api-error.log',
      out_file: '/home/ubuntu/.pm2/logs/dayfax-api-out.log',
      time: true,
    },
  ],
};
