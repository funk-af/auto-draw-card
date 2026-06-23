import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { KillswitchFactory } from '../artifacts/killswitch/KillswitchClient'
import { MainFactory } from '../artifacts/main/MainClient'

// The Killswitch contract verifies card ownership against the Main contract, so it needs
// the Main app id at creation time. We resolve (or idempotently deploy) Main first.
export async function deploy() {
  console.log('=== Deploying Killswitch ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const mainFactory = algorand.client.getTypedAppFactory(MainFactory, {
    defaultSender: deployer.addr,
  })
  const { appClient: mainClient } = await mainFactory.deploy({
    createParams: {
      method: 'deploy',
      args: [deployer.addr.toString(), deployer.addr.toString()],
      extraProgramPages: 3,
    },
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  const factory = algorand.client.getTypedAppFactory(KillswitchFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    createParams: {
      method: 'deploy',
      args: [deployer.addr.toString(), mainClient.appId],
    },
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // If app was just created fund the app account for box MBR
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  console.log(
    `Deployed Killswitch '${appClient.appClient.appName}' (${appClient.appClient.appId}) bound to Main ${mainClient.appId}`,
  )
}
