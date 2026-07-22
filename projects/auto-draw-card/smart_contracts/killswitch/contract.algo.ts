/*
 * MIT License
 *
 * Copyright (c) 2026 Algorand Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  abimethod,
  Account,
  Application,
  arc4,
  assert,
  Asset,
  bytes,
  Global,
  GlobalState,
  Txn,
} from '@algorandfoundation/algorand-typescript'
import { Box, itob } from '@algorandfoundation/algorand-typescript/op'
import { classes } from 'polytype'
import type { Main } from '../main/contract.algo'
import { Ownable } from '../roles/ownable.algo'
import { Pausable } from '../roles/pausable.algo'
import { Recoverable } from '../roles/recoverable.algo'

export class Killswitch extends classes(Ownable, Pausable, Recoverable) {
  // ========== Storage ==========

  // The Main card-management contract, used to verify card ownership before enabling.
  public main_app = GlobalState<Application>({ key: 'ma' })

  // ========== External Functions ==========
  /**
   * Deploy the contract, setting the owner as provided and initializing global state.
   *
   * @param owner The account to set as the contract owner.
   * @param main The Main contract used to verify card ownership when enabling delegation.
   */
  @abimethod({ allowActions: ['NoOp'], onCreate: 'require' })
  public deploy(owner: Account, main: Application): Account {
    this._transferOwnership(owner)
    this._pauser.value = Txn.sender
    this.paused.value = false
    this.main_app.value = main
    return Global.currentApplicationAddress
  }

  /**
   * Checks if the delegation is authorized for the (account, asset) pair.
   *
   * @param account The address of the user to check.
   * @param asset The asset the delegation must be enabled for.
   */
  public authorize(account: Account, asset: Asset): void {
    const key = this.accountAssetKey(account, asset)
    const [, exists] = Box.get(key)
    this.whenNotPaused()
    assert(exists, 'REFUSED')
  }

  /**
   * Enables AutoDraw delegation of the given asset for the caller.
   *
   * The delegation is keyed by (Txn.sender, asset) — the same key `authorize` and `kill`
   * use, and the account the AutoDraw Lsig binds to the axfer sender.
   *
   * Gated to accounts that own a card in the Main contract, to prevent abuse of the
   * owner-funded box MBR. The caller must supply a card address they own; ownership is
   * verified against the Main contract via a cross-contract call.
   *
   * @param card A card address owned by the caller, used to prove card ownership.
   * @param asset The asset to enable delegation for.
   */
  public enable(card: Account, asset: Asset): void {
    const key = this.accountAssetKey(Txn.sender, asset)
    const [, exists] = Box.get(key)
    assert(!exists, 'ALREADY_ENABLED')

    const cardData = arc4.abiCall<typeof Main.prototype.getCardData>({
      appId: this.main_app.value,
      args: [card],
    }).returnValue
    assert(cardData.owner === Txn.sender, 'NOT_CARD_OWNER')

    Box.create(key, 0)
  }

  /**
   * Disables AutoDraw delegation of the given asset for the caller.
   *
   * @param asset The asset to disable delegation for.
   */
  public kill(asset: Asset): void {
    const key = this.accountAssetKey(Txn.sender, asset)
    const [, exists] = Box.get(key)
    assert(exists, 'ALREADY_DISABLED')
    Box.delete(key)
  }

  /**
   * Box key for an (account, asset) delegation: the 32-byte account address
   * concatenated with the 8-byte big-endian asset id.
   */
  private accountAssetKey(account: Account, asset: Asset): bytes {
    return account.bytes.concat(itob(asset.id))
  }
}
