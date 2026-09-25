;; ============================================================
;; Terminal Emacs Configuration
;; ============================================================

;; ------------------------------------------------------------
;; Text selection
;; ------------------------------------------------------------

(setq shift-select-mode t)


;; ------------------------------------------------------------
;; File operations
;; ------------------------------------------------------------

;; Ctrl+O — open file
(global-set-key (kbd "C-o") #'find-file)

;; Ctrl+S — save file
(global-set-key (kbd "C-s") #'save-buffer)

;; Ctrl+Q — exit Emacs
(global-set-key (kbd "C-q") #'save-buffers-kill-terminal)


;; ------------------------------------------------------------
;; Search
;; ------------------------------------------------------------

;; Ctrl+F — search forward
(global-set-key (kbd "C-f") #'isearch-forward)


;; ------------------------------------------------------------
;; Clipboard
;; ------------------------------------------------------------

(defun my-osc52-copy ()
  "Copy the active region to the system clipboard using OSC 52."
  (interactive)
  (when (use-region-p)
    (let* ((text (buffer-substring-no-properties
                  (region-beginning)
                  (region-end)))
           (encoded (base64-encode-string
                     (encode-coding-string text 'utf-8)
                     t)))
      (send-string-to-terminal
       (concat "\e]52;c;" encoded "\a")))))

;; Alt+Insert — copy selection to system clipboard
(global-set-key (kbd "M-<insert>") #'my-osc52-copy)

;; Shift+Insert — paste from Emacs/system clipboard
(global-set-key (kbd "S-<insert>") #'yank)


;; ------------------------------------------------------------
;; Editing
;; ------------------------------------------------------------

;; Ctrl+V — paste
(global-set-key (kbd "C-v") #'yank)

;; Ctrl+U — undo
(global-set-key (kbd "C-u") #'undo)

;; Ctrl+Y — redo
(global-set-key (kbd "C-y") #'undo-redo)


;; ------------------------------------------------------------
;; Buffer switching
;; ------------------------------------------------------------

;; Ctrl+Tab — next buffer
(global-set-key (kbd "C-<tab>") #'next-buffer)

;; Ctrl+Shift+Tab — previous buffer
(global-set-key (kbd "C-S-<tab>") #'previous-buffer)


