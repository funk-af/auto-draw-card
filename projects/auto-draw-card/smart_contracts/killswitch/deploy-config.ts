import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import algosdk from 'algosdk'
import type { KillswitchClient } from '../artifacts/killswitch/KillswitchClient'
import { KillswitchFactory } from '../artifacts/killswitch/KillswitchClient'
import { MainFactory } from '../artifacts/main/MainClient'

export interface DeployKillswitchParams {
  /** Algorand client to use. Defaults to one built from the environment. */
  algorand?: AlgorandClient
  /** Address that creates the app (its signer must be registered with `algorand`). Defaults to the `DEPLOYER` env account. */
  deployer?: string | algosdk.Address
  /** Contract owner address. Defaults to the deployer. */
  owner?: string
  /** Main app id the killswitch is bound to. When omitted, Main is (idempotently) deployed first. */
  mainAppId?: bigint
  /** Amount used to fund the app account on create/replace. Defaults to 1 ALGO. */
  fundAmount?: AlgoAmount
}

// The Killswitch contract verifies card ownership against the Main contract, so it needs
// the Main app id at creation time. We resolve (or idempotently deploy) Main first.
export async function deploy(params: DeployKillswitchParams = {}): Promise<KillswitchClient> {
  console.log('=== Deploying Killswitch ===')

  const algorand = params.algorand ?? AlgorandClient.fromEnvironment()
  const deployer = params.deployer ?? (await algorand.account.fromEnvironment('DEPLOYER')).addr
  const owner = params.owner ?? deployer.toString()

  let mainAppId = params.mainAppId
  if (mainAppId === undefined) {
    const mainFactory = algorand.client.getTypedAppFactory(MainFactory, {
      defaultSender: deployer,
    })
    const { appClient: mainClient } = await mainFactory.deploy({
      createParams: {
        method: 'deploy',
        args: [owner, owner],
        extraProgramPages: 3,
      },
      onUpdate: 'append',
      onSchemaBreak: 'append',
    })
    mainAppId = mainClient.appId
  }

  const factory = algorand.client.getTypedAppFactory(KillswitchFactory, {
    defaultSender: deployer,
  })

  const { appClient, result } = await factory.deploy({
    createParams: {
      method: 'deploy',
      args: [owner, mainAppId],
    },
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // If app was just created fund the app account for box MBR
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: params.fundAmount ?? (1).algo(),
      sender: deployer,
      receiver: appClient.appAddress,
    })
  }

  console.log(
    `Deployed Killswitch '${appClient.appClient.appName}' (${appClient.appClient.appId}) bound to Main ${mainAppId}`,
  )

  return appClient
}
