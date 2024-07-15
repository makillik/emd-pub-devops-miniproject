# EngagedMD: Case Study

This repo deploys an ALB + Website in this account.

## Deployment

Changes to the service can be deployed with `cdk deploy`.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## One-time setup

This repo uses will deploy resources to the default AWS profile configured on your machine. You can override this default by providing the `--profile` flag when running the CDK commands.

Run `cdk bootstrap` to bootstrap a new account/region.

## Limitations / Notes

Updated to Python 3.12, and reviewed CPU/Memory requirements of the ECS task.

This repo can deploy a single instance of this service per account/region. Ideally, we'd be able to namespace the resources accordingly and be able to deploy multiple instances per account/region.

The FargateTaskDefinition assumes a ARM64 based docker image, as the primary developer's machine is building on ARM. If a `cdk deploy` is run from an x86_64 computer, the `cpuArchitecture` configuration in bin/infra.ts will need to be updated to `ecs.CpuArchitecture.X86_64`. 

For a production service, I would consider setting up 2 NAT Gateways (one per AZ) to avoid issues with a single AZ taking down my service.

SSL is not used between the ALB and Container in this setup. Ideally, we'd still use SSL to protect the traffic, even with self-signed certs.

Outbound traffic from the containers is limited to port 443, which is minimally needed to pull down container images from ECR. We could use VPC endpoints to further restrict outgoing traffic.

NACL's could also be used to limit network traffic between the subnets.
