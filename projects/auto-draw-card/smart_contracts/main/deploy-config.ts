import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MainFactory } from '../artifacts/main/MainClient'

// Below is a showcase of various deployment options you can use in TypeScript Client
export async function deploy() {
  console.log('=== Deploying Main ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(MainFactory, {
    defaultSender: deployer.addr,
  })

  // The Main contract requires its owner and omnibus settlement account at creation time.
  // Both default to the deployer here; override the omnibus address for a real deployment.
  const { appClient, result } = await factory.deploy({
    createParams: {
      method: 'deploy',
      args: [deployer.addr.toString(), deployer.addr.toString()],
      extraProgramPages: 3,
    },
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // If app was just created fund the app account
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  console.log(`Deployed Main '${appClient.appClient.appName}' (${appClient.appClient.appId}) owned by ${deployer.addr}`)
}
