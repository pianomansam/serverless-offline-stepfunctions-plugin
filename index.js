const path = require('path');
const AWS = require('aws-sdk');
const stepFunctionsLocal = require('stepfunctions-local');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.service = this.serverless.service.service;
    this.variables =
      this.serverless.service.custom.stepFunctionsLocal ||
      this.serverless.service.custom.stepFunctionsOffline;
    this.provider = this.serverless.getProvider('aws');
    this.region = this.provider.getRegion();
    this.stage = this.provider.getStage();
    this.accountID = '0123456789';
    this.serverlessHost = this.options.host || 'localhost';
    this.serverlessPort = this.options.port || 3000;
    this.serverlessLog = serverless.cli.log.bind(serverless.cli);
    this.stepFunctionsLocal = stepFunctionsLocal;

    this.stepFunctionsApi = new AWS.StepFunctions({
      endpoint: `http://${this.serverlessHost}:4584`,
      region: this.region,
    });

    this.hooks = {
      'offline:start:init': this.startHandler.bind(this),
      'before:offline:start:end': this.endHandler.bind(this),
    };
  }

  async startHandler() {
    this.startStepFunctionsLocal();

    // Test that stepfunctions-local is up and running.
    await this.waitforStepFunctionsLocalStart();

    await this.yamlParse();
    this.stateMachines = this.serverless.service.stepFunctions.stateMachines;

    // Create state machines for each one defined in serverless.yml.
    Promise.all(
      Object.keys(this.stateMachines).map(stateMachineName =>
        this.createStateMachine(stateMachineName),
      ),
    );
  }

  startStepFunctionsLocal() {
    this.serverlessLog('Starting stepfunctions-local');

    // eslint-disable-next-line prettier/prettier
    const lambdaEndpoint = `http://${this.serverlessHost}:${this.serverlessPort}`;
    this.stepFunctionsLocal.start({
      lambdaEndpoint,
      lambdaRegion: this.region,
      ecsRegion: this.region,
      region: this.region,
      stripLambdaArn: true,
    });
  }

  async waitforStepFunctionsLocalStart() {
    let result;
    let retries = 0;

    this.serverlessLog('Waiting for stepfunctions-local to be up...');

    do {
      try {
        result = await this.stepFunctionsApi.listStateMachines().promise();
      } catch (e) {
        retries += 1;
        if (retries <= 5) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw e;
        }
      }
    } while (!result);

    this.serverlessLog('Stepfunctions-local is up');

    return result;
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
          `arn:aws:lambda:${this.region}:${this.accountID}:function:${this.service}-${this.stage}-${this.variables[stateName]}`;
        break;

      default:
        throw new Error(`Unsupported resource type: ${state.Type}`);
    }

    return state;
  }

  endHandler() {
    this.serverlessLog('Stopping stepfunctions-local');
    this.stepFunctionsLocal.stop();
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
