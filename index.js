const stepFunctionsLocal = require('stepfunctions-local');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.region = this.serverless.service.provider.region;
    this.serverlessHost = this.options.host || 'localhost';
    this.serverlessPort = this.options.port || 3000;
    this.serverlessLog = serverless.cli.log.bind(serverless.cli);
    this.stepFunctionsLocal = stepFunctionsLocal;

    this.hooks = {
      'offline:start:init': this.startHandler.bind(this),
      'before:offline:start:end': this.endHandler.bind(this),
    };
  }

  startHandler() {
    this.serverlessLog('Starting stepfunctions-local');
    // console.log(this.serverless);
    // eslint-disable-next-line prettier/prettier
    const lambdaEndpoint = `http://${this.serverlessHost}:${this.serverlessPort}`;
    this.stepFunctionsLocal.start({
      lambdaEndpoint,
      lambdaRegion: this.region,
      ecsRegion: this.region,
      region: this.region,
    });
  }

  endHandler() {
    this.serverlessLog('Stopping stepfunctions-local');
    this.stepFunctionsLocal.stop();
  }
}

module.exports = ServerlessPlugin;
