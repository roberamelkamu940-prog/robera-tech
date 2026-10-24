module.exports = {
  apps : [{
    name: "robera-tech",
    script: "./server.js",
    instances: "max", // Cluster mode across all available CPU cores
    exec_mode: "cluster",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};