import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import algosdk from 'algosdk'
import type { MainClient } from '../artifacts/main/MainClient'
import { MainFactory } from '../artifacts/main/MainClient'

export interface DeployMainParams {
  /** Algorand client to use. Defaults to one built from the environment. */
  algorand?: AlgorandClient
  /** Address that creates the app (its signer must be registered with `algorand`). Defaults to the `DEPLOYER` env account. */
  deployer?: string | algosdk.Address
  /** Contract owner address. Defaults to the deployer. */
  owner?: string
  /** Omnibus settlement address. Defaults to the deployer. */
  omnibus?: string
  /** Amount used to fund the app account on create/replace. Defaults to 1 ALGO. */
  fundAmount?: AlgoAmount
}

// Below is a showcase of various deployment options you can use in TypeScript Client
export async function deploy(params: DeployMainParams = {}): Promise<MainClient> {
  console.log('=== Deploying Main ===')

  const algorand = params.algorand ?? AlgorandClient.fromEnvironment()
  const deployer = params.deployer ?? (await algorand.account.fromEnvironment('DEPLOYER')).addr
  const owner = params.owner ?? deployer.toString()
  const omnibus = params.omnibus ?? deployer.toString()

  const factory = algorand.client.getTypedAppFactory(MainFactory, {
    defaultSender: deployer,
  })

  // The Main contract requires its owner and omnibus settlement account at creation time.
  // Both default to the deployer here; override the omnibus address for a real deployment.
  const { appClient, result } = await factory.deploy({
    createParams: {
      method: 'deploy',
      args: [owner, omnibus],
      extraProgramPages: 3,
    },
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // If app was just created fund the app account
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: params.fundAmount ?? (1).algo(),
      sender: deployer,
      receiver: appClient.appAddress,
    })
  }

  console.log(`Deployed Main '${appClient.appClient.appName}' (${appClient.appClient.appId}) owned by ${owner}`)

  return appClient
}
