module.exports = {
  apps: [{
    name: 'arbitrage-bot',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    
    // Environment configuration
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'debug'
    },
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info'
    },
    
    // Logging configuration
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Memory and CPU limits
    max_memory_restart: '500M',
    
    // Auto-restart configuration
    autorestart: true,
    watch: false,
    
    // Advanced PM2 features
    instance_var: 'INSTANCE_ID',
    
    // Environment variables for production
    env_vars: {
      'NODE_OPTIONS': '--max-old-space-size=512'
    },
    
    // Cron restart (restart every day at 2 AM)
    cron_restart: '0 2 * * *',
    
    // Health check
    health_check_grace_period: 3000,
    
    // Error handling
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Monitoring
    monitoring: false,
    
    // Source map support
    source_map_support: true,
    
    // Ignore specific files/folders when watching
    ignore_watch: [
      'node_modules',
      'logs',
      'dist',
      '.git',
      '*.log'
    ],
    
    // Graceful shutdown
    shutdown_with_message: true,
    
    // Additional configuration for trading bot
    merge_logs: true,
    
    // Custom startup script
    post_update: ['npm install', 'npm run build'],
    
    // Interpreter options
    interpreter_args: '--harmony',
    
    // Custom environment variables for the arbitrage bot
    env_file: '.env'
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/usdt-arbitrage-bot.git',
      path: '/var/www/arbitrage-bot',
      
      // Pre-deployment actions
      'pre-deploy-local': '',
      
      // Post-deployment actions
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      
      // Pre-setup actions
      'pre-setup': '',
      
      // Post-setup actions
      'post-setup': 'ls -la'
    },
    
    staging: {
      user: 'ubuntu',
      host: 'staging-server-ip',
      ref: 'origin/develop',
      repo: 'https://github.com/your-username/usdt-arbitrage-bot.git',
      path: '/var/www/arbitrage-bot-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging'
    }
  }
};