# serverless-offline-stepfunctions


## Overview


This [Serverless Offline](https://www.npmjs.com/package/serverless-offline) plugin provides local support for [Serverless Step Functions](https://www.npmjs.com/package/serverless-step-functions). It creates state machines for every stepFunctions entry on a local step function emulator.

This plugin doesn't manage the local step function emulator. You need to install and start the emulator before using this plugin.

Tested emulators:
- [stepfunctions-local standalone](https://www.npmjs.com/package/stepfunctions-local)
- stepfunctions-local via [serverless-offline-stepfunctions-local](https://github.com/pianomansam/serverless-offline-stepfunctions-local) plugin


## Installation
```
npm install serverless-offline-stepfunctions
```
OR
```
yarn add serverless-offline-stepfunctions
```

## Usage

1. Enable this plugin by editing your `serverless.yml` file and placing an `serverless-offline-stepfunctions` entry in the plugins section, **placed above the `serverless-offline` plugin**
2. Create a `offlineStepFunctions` entry in the `custom` section.
3. Add a `functions` property with an entry for each lambda task, with the property name being the state name and the value being the function name.
For example, if you have a lambda task named "HelloWorld" which invokes a lambda function named "hello", create this entry: `HelloWorld: hello`.
See `serverless.yml` example below.
4. (Optional) Add a `host` and `port` property defining the emulator host and port. Default host is `localhost` and default port is `4584`.


## Example

serverless.yml:
```yaml
plugins:
  # Note how this comes before serverless-offline
  - serverless-step-functions
  - serverless-offline-stepfunctions
  - serverless-offline

functions:
  hello:
    handler: src/hello.default
    
stepFunctions:
  stateMachines:
    Test:
      definition:
        Comment: Test Step Function
        StartAt: HelloWorld
        States:
          HelloWorld:
            Type: Task
            Resource:
              Fn::GetAtt: [HelloLambdaFunction, Arn]
            End: true

custom:
  offlineStepFunctions:
    host: localhost
    port: 4584
    functions: 
	HelloWorld: hello
```

### Execute via AWS CLI
```
aws stepfunctions --endpoint http://localhost:4584 start-execution --state-machine-arn "arn:aws:states:us-east-1:0123456789:stateMachine:Test" --input '{"first": 1, "second": 2}'
```


### Executing via AWS JS SDK

```js
const AWS = require('aws-sdk');

const stepFunctions = new AWS.StepFunctions({
	endpoint: `http://localhost:4584`,
});

const response = stepFunctions
	.startExecution({
		stateMachineArn: 'arn:aws:states:us-east-1:0123456789:stateMachine:Test',
		input: JSON.stringify({{"first": 1, "second": 2}}),
	})
	.promise();

```

## Comparison to other plugins

### [serverless-step-functions-offline](https://github.com/vkkis93/serverless-step-functions-offline)

This plugin has an internal simulation of the Step Function API. It supports a [subset](https://github.com/vkkis93/serverless-step-functions-offline#what-does-plugin-support) of the API and runs independently of Serverless Offline. Because of this, it cannot support direct API calls from AWS JS SDK or CLI. For example, you cannot start state machine execution from lambda function. You can only start execution from the command line. Furthermore, it only supports NodeJS lambda tasks.

### [serverless-offline-step-functions](https://github.com/flocasts/serverless-offline-step-functions)

Like the plugin above it (serverless-step-functions-offline), this plugin internally simulates Step Functions. It has no support for AWS JS SDK or CLI and has implemented even less of the Step Functions API.


### [serverless-step-functions-local](https://github.com/codetheweb/serverless-step-functions-local#readme)
This plugin downloads and wraps AWS's [Step Functions Local](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html) and creates state machines for each stepFunctions entry. It's the closest to this plugin in terms of functionality. But the one main distinction is that it manages your Step Functions emulator for you, which also means you have to use its emulator. On the contrary, serverless-offline-stepfunctions defers that decision and control, so you are free to use whatever emulator you wish.

	
## Roadmap
- [ ] Integrate with [Step Functions Local](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [ ] Integration with Localstack
