const path = require('path');
const AWS = require('aws-sdk');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.service = this.serverless.service.service;
    this.config = this.serverless.service.custom.offlineStepFunctions;
    this.provider = this.serverless.getProvider('aws');
    this.region = this.provider.getRegion();
    this.stage = this.provider.getStage();
    this.accountID = '000000000000';
    this.stepFunctionHost = this.config.host || 'localhost';
    this.stepFunctionPort = this.config.port || 4584;
    this.serverlessLog = serverless.cli.log.bind(serverless.cli);

    this.stepFunctionsApi = new AWS.StepFunctions({
      endpoint: `http://${this.stepFunctionHost}:${this.stepFunctionPort}`,
      region: this.region,
    });

    this.hooks = {
      'offline:start': this.startHandler.bind(this),
      'offline:start:init': this.startHandler.bind(this),
    };
  }

  async startHandler() {
    await this.yamlParse();
    this.stateMachines = this.serverless.service.stepFunctions.stateMachines;

    // Create state machines for each one defined in serverless.yml.
    Promise.all(
      Object.keys(this.stateMachines).map(stateMachineName =>
        this.createStateMachine(stateMachineName),
      ),
    );
  }

  createStateMachine(stateMachineName) {
    this.serverlessLog(`Creating state machine ${stateMachineName}`);

    const params = {
      name: stateMachineName,
      definition: JSON.stringify(
        this.buildStateMachine(this.stateMachines[stateMachineName].definition),
      ),
      roleArn: `arn:aws:iam::${this.accountID}:role/service-role/MyRole`,
    };
    return this.stepFunctionsApi.createStateMachine(params).promise();
  }

  buildStateMachine(stateMachine) {
    if (stateMachine.States) {
      // eslint-disable-next-line no-param-reassign
      stateMachine.States = this.buildStates(stateMachine.States);
    }

    return stateMachine;
  }

  buildStates(states) {
    const stateNames = Object.keys(states);
    stateNames.forEach(stateName => {
      const state = states[stateName];
      if (state.Resource) {
        // eslint-disable-next-line no-param-reassign
        states[stateName] = this.buildStateArn(state, stateName);
      }

      if (state.Branches) {
        state.Branches.map(branch => {
          // eslint-disable-next-line no-param-reassign
          branch.States = this.buildStates(branch.States);
          return branch;
        });
      }
    });

    return states;
  }

  buildStateArn(state, stateName) {
    switch (state.Type) {
      case 'Task':
        // eslint-disable-next-line no-param-reassign
        state.Resource =
          // eslint-disable-next-line prettier/prettier
          `arn:aws:lambda:${this.region}:${this.accountID}:function:${this.service}-${this.stage}-${this.config.functions[stateName]}`;
        break;

      default:
        throw new Error(`Unsupported resource type: ${state.Type}`);
    }

    return state;
  }

  yamlParse() {
    const { servicePath } = this.serverless.config;
    if (!servicePath) {
      return Promise.resolve();
    }

    const serverlessYmlPath = path.join(servicePath, 'serverless.yml');
    return this.serverless.yamlParser
      .parse(serverlessYmlPath)
      .then(serverlessFileParam =>
        this.serverless.variables
          .populateObject(serverlessFileParam)
          .then(parsedObject => {
            this.serverless.service.stepFunctions = {};
            this.serverless.service.stepFunctions.stateMachines =
              parsedObject.stepFunctions &&
              parsedObject.stepFunctions.stateMachines
                ? parsedObject.stepFunctions.stateMachines
                : {};
            this.serverless.service.stepFunctions.activities =
              parsedObject.stepFunctions &&
              parsedObject.stepFunctions.activities
                ? parsedObject.stepFunctions.activities
                : [];

            if (!this.serverless.pluginManager.cliOptions.stage) {
              this.serverless.pluginManager.cliOptions.stage =
                this.options.stage ||
                (this.serverless.service.provider &&
                  this.serverless.service.provider.stage) ||
                'dev';
            }

            if (!this.serverless.pluginManager.cliOptions.region) {
              this.serverless.pluginManager.cliOptions.region =
                this.options.region ||
                (this.serverless.service.provider &&
                  this.serverless.service.provider.region) ||
                'us-east-1';
            }

            this.serverless.variables.populateService(
              this.serverless.pluginManager.cliOptions,
            );
            return Promise.resolve();
          }),
      );
  }
}

module.exports = ServerlessPlugin;
