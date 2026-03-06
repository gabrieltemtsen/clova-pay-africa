;; clova-deposit.clar
;; 
;; Clarity smart contract for collecting USDCx deposits on Stacks.
;; Users call `deposit` to send USDCx for offramp processing.
;; The orderId (from POST /v1/orders) is passed as the `memo` argument
;; so the Clova watcher can match the deposit to a pending order.
;;
;; Admin (contract-deployer) can withdraw collected USDCx to a treasury address.
;;
;; USDCx SIP-010 contract: SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.usdc

;; ── Constants ────────────────────────────────────────────────────────────────

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ZERO-AMOUNT (err u101))
(define-constant ERR-TRANSFER-FAILED (err u102))
(define-constant ERR-INSUFFICIENT-BALANCE (err u103))

;; USDCx token contract (SIP-010)
(define-constant USDCX-CONTRACT 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.usdc)

;; ── Data vars ────────────────────────────────────────────────────────────────

;; Total USDCx held in this contract
(define-data-var total-deposits uint u0)

;; ── SIP-010 trait ────────────────────────────────────────────────────────────

(use-trait sip010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; ── Events (via print) ───────────────────────────────────────────────────────

;; Deposit event — emitted when a user deposits USDCx
;; The off-chain watcher listens for these to trigger order settlement
(define-private (emit-deposit (sender principal) (amount uint) (memo (buff 64)))
  (print {
    event: "deposit",
    sender: sender,
    amount: amount,
    memo: memo,
    contract: (as-contract tx-sender)
  })
)

;; Withdrawal event
(define-private (emit-withdrawal (recipient principal) (amount uint))
  (print {
    event: "withdrawal",
    recipient: recipient,
    amount: amount,
    contract: (as-contract tx-sender)
  })
)

;; ── Public functions ─────────────────────────────────────────────────────────

;; deposit: transfer USDCx from caller to this contract
;; @param token     - the USDCx SIP-010 token trait
;; @param amount    - amount in USDCx micro-units (6 decimals, so $1 = 1000000)
;; @param memo      - orderId from Clova API as utf8 buffer (e.g. "ord_abc123...")
;;
;; Example call (Stacks.js):
;;   await callContract({
;;     contractAddress: "SP...",
;;     contractName: "clova-deposit",
;;     functionName: "deposit",
;;     functionArgs: [uintCV(1000000), bufferFromHex(hexEncode("ord_abc123..."))]
;;   })
(define-public (deposit (token <sip010-trait>) (amount uint) (memo (buff 64)))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    ;; Transfer USDCx from caller to this contract
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) (some memo)))
    ;; Update running total
    (var-set total-deposits (+ (var-get total-deposits) amount))
    ;; Emit deposit event for watcher
    (emit-deposit tx-sender amount memo)
    (ok { deposited: amount, memo: memo })
  )
)

;; withdraw: admin-only — sweep collected USDCx to a recipient
;; @param token     - the USDCx SIP-010 token trait
;; @param amount    - amount to withdraw
;; @param recipient - destination Stacks principal
(define-public (withdraw (token <sip010-trait>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    ;; Transfer from contract to recipient
    (try! (as-contract (contract-call? token transfer amount (as-contract tx-sender) recipient none)))
    ;; Update running total (safe subtraction)
    (var-set total-deposits
      (if (>= (var-get total-deposits) amount)
        (- (var-get total-deposits) amount)
        u0))
    (emit-withdrawal recipient amount)
    (ok { withdrawn: amount, recipient: recipient })
  )
)

;; ── Read-only functions ──────────────────────────────────────────────────────

;; get-total-deposits: total USDCx deposited (lifetime, not current balance)
(define-read-only (get-total-deposits)
  (var-get total-deposits)
)

;; get-contract-owner
(define-read-only (get-contract-owner)
  CONTRACT-OWNER
)
