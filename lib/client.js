// dsh-im-hub — browser (client) half.
//
// Renders a visual configuration card for the plugin inside the Web GUI's
// plugin-settings surface (the "Configurable plugins" tab), editing the
// `im-hub` dsh-settings namespace the Host plugin registers. The card is a
// hand-written ModuleLoader module: it depends only on services the official
// client runtime provides (`slots`, `settingsScope`, `locale`, react), so it
// ships inside this npm package with no build step.
//
// The card mirrors the official ui-plugin-config PluginCard chrome in a
// self-contained slice (this package must not depend on a sibling UI package).

window.__ModuleLoader__.load({
	id: "dsh-im-hub",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let runtime = require("@deepseek-ai/dsh-client-runtime/client");

		// ---------------------------------------------------------------- css
		const css = ".imHub_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:8px;list-style:none;transition:border-color .16s,background .16s;overflow:hidden}.imHub_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.imHub_header{cursor:pointer;text-align:left;width:100%;font:inherit;background:0 0;border:0;align-items:center;gap:8px;padding:10px 14px;display:flex}.imHub_header:hover{background:var(--dsw-alias-interactive-bg-hover)}.imHub_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.imHub_name{color:var(--dsw-alias-label-primary);font-weight:600}.imHub_description{color:var(--dsw-alias-label-tertiary);font-size:12px}.imHub_pending{color:var(--dsw-alias-state-warn-primary);font-size:12px}.imHub_chevron{color:var(--dsw-alias-label-tertiary);transition:transform .12s}.imHub_chevronOpen{transform:rotate(180deg)}.imHub_body{flex-direction:column;gap:14px;padding:0 14px 14px;display:flex}.imHub_readOnly{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}.imHub_footer{justify-content:flex-end;align-items:center;gap:8px;display:flex}.imHub_failed{color:var(--dsw-alias-state-error-primary);margin:0 auto 0 0;font-size:12px}.imHub_discard,.imHub_save{font:inherit;cursor:pointer;border-radius:6px;padding:5px 12px;font-size:13px}.imHub_discard{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.imHub_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.imHub_save{border:1px solid var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground)}.imHub_save:hover:not(:disabled){border-color:var(--dsw-alias-button-info-hover);background:var(--dsw-alias-button-info-hover)}.imHub_discard:active:not(:disabled),.imHub_save:active:not(:disabled){transform:translateY(1px)}.imHub_discard:focus-visible:not(:disabled),.imHub_save:focus-visible:not(:disabled){outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.imHub_discard:disabled,.imHub_save:disabled{opacity:.5;cursor:default}.imHub_field{flex-direction:column;gap:4px;display:flex}.imHub_head{align-items:center;gap:8px;display:flex}.imHub_label{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}.imHub_badges{align-items:center;gap:6px;display:flex}.imHub_badge{background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-state-business-primary);border-radius:999px;padding:1px 6px;font-size:11px}.imHub_badgeMuted{background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 6px;font-size:11px}.imHub_reset{color:var(--dsw-alias-state-business-primary);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.imHub_reset:hover:not(:disabled){text-decoration:underline}.imHub_reset:active:not(:disabled){opacity:.8;text-decoration:underline}.imHub_reset:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.imHub_reset:disabled{opacity:.5;cursor:default}.imHub_input,.imHub_select{border:1px solid var(--dsw-alias-border-l2);font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);border-radius:6px;padding:6px 8px;font-size:13px}.imHub_inputInvalid{border:1px solid var(--dsw-alias-state-error-primary);font:inherit;color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}.imHub_input:disabled,.imHub_select:disabled{opacity:.6}.imHub_hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px}.imHub_invalid{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px}.imHub_header:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.imHub_header:active{background:var(--dsw-alias-interactive-bg-hover)}.imHub_header,.imHub_discard,.imHub_save,.imHub_reset{transition:background-color .12s,color .12s,border-color .12s,transform .12s}.imHub_groupTitle{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin:2px 0 -4px}.imHub_sep{height:1px;background:var(--dsw-alias-border-l2);margin:2px 0 0}@media (prefers-reduced-motion:reduce){.imHub_card,.imHub_header,.imHub_chevron,.imHub_discard,.imHub_save,.imHub_reset{transition:none}}";
		// DSH themes differ in their label tokens. Keep configuration guidance legible
		// even when a theme makes the inherited setting labels nearly transparent.
		const readabilityCss = ".imHub_field{gap:6px}.imHub_label{display:block!important;color:#f2f6ff!important;line-height:1.4;opacity:1!important;visibility:visible!important}.imHub_hint{display:block!important;color:#b8c6dd!important;line-height:1.45;opacity:1!important;visibility:visible!important}.imHub_input::placeholder{color:#aebed8!important;opacity:1!important}.imHub_input,.imHub_select{min-height:34px}.imHub_head{min-height:19px}";
		const tagId = "dsh-im-hub/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-im-hub";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css + readabilityCss;
			document.head.appendChild(tag);
		}
		const cssDefault = {
			"badge": "imHub_badge",
			"badgeMuted": "imHub_badgeMuted",
			"badges": "imHub_badges",
			"body": "imHub_body",
			"card": "imHub_card",
			"cardOpen": "imHub_cardOpen",
			"chevron": "imHub_chevron",
			"chevronOpen": "imHub_chevronOpen",
			"description": "imHub_description",
			"discard": "imHub_discard",
			"failed": "imHub_failed",
			"field": "imHub_field",
			"footer": "imHub_footer",
			"groupTitle": "imHub_groupTitle",
			"head": "imHub_head",
			"headText": "imHub_headText",
			"header": "imHub_header",
			"hint": "imHub_hint",
			"input": "imHub_input",
			"inputInvalid": "imHub_inputInvalid",
			"invalid": "imHub_invalid",
			"label": "imHub_label",
			"name": "imHub_name",
			"pending": "imHub_pending",
			"readOnly": "imHub_readOnly",
			"reset": "imHub_reset",
			"save": "imHub_save",
			"select": "imHub_select",
			"sep": "imHub_sep"
		};

		// -------------------------------------------------------------- chrome
		/**
		 * Shared chrome for one plugin settings card: disclosure header, the
		 * controls inside, and a save/discard footer. Renders nothing while the
		 * namespace is unavailable.
		 */
		function PluginSettingsCard(props) {
			const [open, setOpen] = react.useState(false);
			const { state } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			return react_jsx_runtime.jsxs("li", {
				className: cssDefault.card + (open ? " " + cssDefault.cardOpen : ""),
				children: [
					react_jsx_runtime.jsxs("button", {
						type: "button",
						className: cssDefault.header,
						"aria-expanded": open,
						"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
						onClick: () => setOpen(!open),
						children: [
							react_jsx_runtime.jsxs("span", {
								className: cssDefault.headText,
								children: [
									react_jsx_runtime.jsx("span", { className: cssDefault.name, children: title }),
									react_jsx_runtime.jsx("span", { className: cssDefault.description, children: props.t(props.descriptionKey) })
								]
							}),
							state.dirty ? react_jsx_runtime.jsx("span", { className: cssDefault.pending, children: props.t("settings.unsaved") }) : null,
							react_jsx_runtime.jsx("span", { className: cssDefault.chevron + (open ? " " + cssDefault.chevronOpen : ""), children: "\u25be" })
						]
					}),
					open ? react_jsx_runtime.jsxs("div", {
						className: cssDefault.body,
						children: [
							!state.writable ? react_jsx_runtime.jsx("p", { className: cssDefault.readOnly, role: "status", children: props.t("settings.readOnly") }) : null,
							props.children,
							react_jsx_runtime.jsxs("div", {
								className: cssDefault.footer,
								children: [
									state.failed ? react_jsx_runtime.jsx("p", { className: cssDefault.failed, role: "status", children: props.t("settings.saveFailed") }) : null,
									react_jsx_runtime.jsx("button", {
										type: "button",
										className: cssDefault.discard,
										disabled: !state.dirty || state.saving,
										onClick: props.onDiscard,
										children: props.t("settings.discard")
									}),
									react_jsx_runtime.jsx("button", {
										type: "button",
										className: cssDefault.save,
										disabled: blocked,
										onClick: props.onSave,
										children: props.t(state.saving ? "settings.saving" : "settings.save")
									})
								]
							})
						]
					}) : null
				]
			});
		}

		/** A plain text (or numeric) value field. */
		function ValueField(props) {
			return react_jsx_runtime.jsxs("div", {
				className: cssDefault.field,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: cssDefault.head,
						children: [
							react_jsx_runtime.jsx("label", { className: cssDefault.label, htmlFor: props.id, children: props.label }),
							props.overridden ? react_jsx_runtime.jsxs("span", {
								className: cssDefault.badges,
								children: [
									react_jsx_runtime.jsx("span", { className: cssDefault.badge, children: props.overriddenLabel }),
									react_jsx_runtime.jsx("button", { type: "button", className: cssDefault.reset, disabled: props.disabled, onClick: props.onReset, children: props.resetLabel })
								]
							}) : null
						]
					}),
					react_jsx_runtime.jsx("input", {
						id: props.id,
						className: props.invalid ? cssDefault.inputInvalid : cssDefault.input,
						type: "text",
						...(props.numeric === true ? { inputMode: "numeric" } : {}),
						...(props.invalid ? { "aria-invalid": true } : {}),
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => props.onEdit(event.target.value)
					}),
					react_jsx_runtime.jsx("p", { className: props.invalid ? cssDefault.invalid : cssDefault.hint, children: props.invalid ? props.invalidLabel : props.hint })
				]
			});
		}

		/** A boolean field edited through a true/false select. */
		function BooleanField(props) {
			return react_jsx_runtime.jsxs("div", {
				className: cssDefault.field,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: cssDefault.head,
						children: [
							react_jsx_runtime.jsx("label", { className: cssDefault.label, htmlFor: props.id, children: props.label }),
							props.overridden ? react_jsx_runtime.jsxs("span", {
								className: cssDefault.badges,
								children: [
									react_jsx_runtime.jsx("span", { className: cssDefault.badge, children: props.overriddenLabel }),
									react_jsx_runtime.jsx("button", { type: "button", className: cssDefault.reset, disabled: props.disabled, onClick: props.onReset, children: props.resetLabel })
								]
							}) : null
						]
					}),
					react_jsx_runtime.jsxs("select", {
						id: props.id,
						className: cssDefault.select,
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => props.onEdit(event.target.value),
						children: [
							react_jsx_runtime.jsx("option", { value: "", children: props.inheritLabel }),
							react_jsx_runtime.jsx("option", { value: "true", children: props.onLabel }),
							react_jsx_runtime.jsx("option", { value: "false", children: props.offLabel })
						]
					}),
					react_jsx_runtime.jsx("p", { className: cssDefault.hint, children: props.hint })
				]
			});
		}

		/**
		 * A write-only credential control. The value never rides a response, so
		 * the control reports only whether one is configured and starts blank; a
		 * blank draft writes nothing, which keeps the stored key rather than
		 * clearing it.
		 */
		function SecretField(props) {
			return react_jsx_runtime.jsxs("div", {
				className: cssDefault.field,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: cssDefault.head,
						children: [
							react_jsx_runtime.jsx("label", { className: cssDefault.label, htmlFor: props.id, children: props.label }),
							react_jsx_runtime.jsx("span", {
								className: cssDefault.badges,
								children: react_jsx_runtime.jsx("span", { className: props.configured ? cssDefault.badge : cssDefault.badgeMuted, children: props.stateLabel })
							})
						]
					}),
					react_jsx_runtime.jsx("input", {
						id: props.id,
						className: cssDefault.input,
						type: "password",
						autoComplete: "off",
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => props.onEdit(event.target.value)
					}),
					react_jsx_runtime.jsx("p", { className: cssDefault.hint, children: props.hint })
				]
			});
		}

		// --------------------------------------------------------------- form
		/** A staged boolean field. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					if (text === "true") return { kind: "set", value: true };
					if (text === "false") return { kind: "set", value: false };
				}
			};
		}

		/** A staged text value (empty text clears the override). */
		function textField(field) {
			return {
				field,
				format: (value) => typeof value === "string" ? value : "",
				parse: (text) => text === "" ? { kind: "clear" } : { kind: "set", value: text }
			};
		}

		/** A staged numeric value. */
		function numberField(field) {
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					if (text === "") return { kind: "clear" };
					const value = Number(text);
					return Number.isFinite(value) ? { kind: "set", value } : void 0;
				}
			};
		}

		/**
		 * A staged write-only credential. Blank drafts are not writes (keeps the
		 * stored secret); the configured badge comes from the snapshot's `secrets`
		 * list, never from a value.
		 */
		function secretField(field) {
			return {
				field,
				secret: true,
				format: () => "",
				parse: (text) => text === "" ? void 0 : { kind: "set", value: text }
			};
		}

		/**
		 * Stages one card's edits over one settings namespace and writes them on
		 * save. The Host is the only authority on whether a value was accepted —
		 * its validators own the constraints no schema can express — so the
		 * outcome is read back from the section rather than predicted here.
		 */
		var CardForm = class {
			constructor(scope, specs) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.staged = new Map();
				this.listeners = new Set();
				this.saving = false;
				this.failed = false;
				scope.subscribe(() => this.publish());
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = runtime.createSnapshotStore(project());
				this.listeners.add(() => store.set(project()));
				return store;
			}
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed
				};
			}
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				const snapshot = this.scope.getSnapshot();
				if (spec.secret === true) {
					const configured = snapshot.secrets?.some((entry) => entry.path?.length === 1 && entry.path[0] === field && entry.set);
					if (staged === void 0) return { text: "", overridden: false, invalid: false, configured };
					const write = spec.parse(staged.text);
					return { text: staged.text, overridden: write?.kind === "set", invalid: false, configured };
				}
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			actions() {
				return {
					edit: (field, text) => this.stage(field, { text, clear: false }),
					resetField: (field) => {
						const spec = this.specOf(field);
						this.stage(field, spec.secret === true ? { text: "", clear: true } : { text: spec.format(this.baseValue(field)), clear: true });
					},
					save: () => this.save(),
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.publish();
					}
				};
			}
			async save() {
				const plan = this.plan();
				const writes = plan.flatMap((item) => item.run === void 0 ? [] : [item.run]);
				if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
				this.saving = true;
				this.failed = false;
				this.publish();
				let landed = true;
				for (const write of writes) landed = await write() && landed;
				if (landed) this.staged.clear();
				this.saving = false;
				this.failed = !landed;
				this.publish();
			}
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (spec.secret === true) {
						if (staged.clear) {
							if (this.secretConfigured(field)) plan.push({ field, run: () => this.clear(field) });
							continue;
						}
						if (staged.text === "") continue;
						const write = spec.parse(staged.text);
						if (write === void 0) plan.push({ field, run: void 0 });
						else plan.push({ field, run: () => this.store(field, write.value) });
						continue;
					}
					if (staged.clear) {
						if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({ field, run: void 0 });
					else if (write.kind === "clear") plan.push({ field, run: () => this.clear(field) });
					else plan.push({ field, run: () => this.store(field, write.value) });
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				return this.userLayer()?.[field] === value;
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			secretConfigured(field) {
				return this.snapshotOf().secrets?.some((entry) => entry.path?.length === 1 && entry.path[0] === field && entry.set) ?? false;
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};

		// ------------------------------------------------------------- fields
		/** Field specs in display order, grouped for the card. */
		const FIELD_GROUPS = [
			{
				key: "general",
				fields: [
					{ field: "enabled", spec: booleanField("enabled"), kind: "bool", labelKey: "f.enabled", hintKey: "f.enabledHint" }
				]
			},
			{
				key: "telegram",
				fields: [
					{ field: "telegramEnabled", spec: booleanField("telegramEnabled"), kind: "bool", labelKey: "f.telegramEnabled", hintKey: "f.telegramEnabledHint" },
					{ field: "telegramToken", spec: secretField("telegramToken"), kind: "secret", labelKey: "f.telegramToken", hintKey: "f.telegramTokenHint", placeholderKey: "p.telegramToken" },
					{ field: "telegramAllowedUserIds", spec: textField("telegramAllowedUserIds"), kind: "text", labelKey: "f.telegramAllowedUserIds", hintKey: "f.allowedUserIdsHint", placeholderKey: "p.telegramAllowedUserIds" }
				]
			},
			{
				key: "feishu",
				fields: [
					{ field: "feishuEnabled", spec: booleanField("feishuEnabled"), kind: "bool", labelKey: "f.feishuEnabled", hintKey: "f.feishuEnabledHint" },
					{ field: "feishuAppId", spec: textField("feishuAppId"), kind: "text", labelKey: "f.feishuAppId", hintKey: "f.feishuAppIdHint", placeholderKey: "p.feishuAppId" },
					{ field: "feishuAppSecret", spec: secretField("feishuAppSecret"), kind: "secret", labelKey: "f.feishuAppSecret", hintKey: "f.secretHint", placeholderKey: "p.feishuAppSecret" },
					{ field: "feishuAllowedUserIds", spec: textField("feishuAllowedUserIds"), kind: "text", labelKey: "f.feishuAllowedUserIds", hintKey: "f.allowedUserIdsHint", placeholderKey: "p.feishuAllowedUserIds" }
				]
			},
			{
				key: "lark",
				fields: [
					{ field: "larkEnabled", spec: booleanField("larkEnabled"), kind: "bool", labelKey: "f.larkEnabled", hintKey: "f.larkEnabledHint" },
					{ field: "larkAppId", spec: textField("larkAppId"), kind: "text", labelKey: "f.larkAppId", hintKey: "f.feishuAppIdHint", placeholderKey: "p.larkAppId" },
					{ field: "larkAppSecret", spec: secretField("larkAppSecret"), kind: "secret", labelKey: "f.larkAppSecret", hintKey: "f.secretHint", placeholderKey: "p.larkAppSecret" },
					{ field: "larkAllowedUserIds", spec: textField("larkAllowedUserIds"), kind: "text", labelKey: "f.larkAllowedUserIds", hintKey: "f.allowedUserIdsHint", placeholderKey: "p.larkAllowedUserIds" }
				]
			},
			{
				key: "wecom",
				fields: [
					{ field: "wecomEnabled", spec: booleanField("wecomEnabled"), kind: "bool", labelKey: "f.wecomEnabled", hintKey: "f.wecomEnabledHint" },
					{ field: "wecomCorpId", spec: textField("wecomCorpId"), kind: "text", labelKey: "f.wecomCorpId", hintKey: "f.wecomCorpIdHint", placeholderKey: "p.wecomCorpId" },
					{ field: "wecomCorpSecret", spec: secretField("wecomCorpSecret"), kind: "secret", labelKey: "f.wecomCorpSecret", hintKey: "f.secretHint", placeholderKey: "p.wecomCorpSecret" },
					{ field: "wecomAgentId", spec: textField("wecomAgentId"), kind: "text", labelKey: "f.wecomAgentId", hintKey: "f.wecomAgentIdHint", placeholderKey: "p.wecomAgentId" },
					{ field: "wecomToken", spec: secretField("wecomToken"), kind: "secret", labelKey: "f.wecomToken", hintKey: "f.secretHint", placeholderKey: "p.wecomToken" },
					{ field: "wecomEncodingAesKey", spec: secretField("wecomEncodingAesKey"), kind: "secret", labelKey: "f.wecomEncodingAesKey", hintKey: "f.secretHint", placeholderKey: "p.wecomEncodingAesKey" },
					{ field: "wecomAllowedUserIds", spec: textField("wecomAllowedUserIds"), kind: "text", labelKey: "f.wecomAllowedUserIds", hintKey: "f.allowedUserIdsHint", placeholderKey: "p.wecomAllowedUserIds" }
				]
			},
			{
				key: "mock",
				fields: [
					{ field: "mockEnabled", spec: booleanField("mockEnabled"), kind: "bool", labelKey: "f.mockEnabled", hintKey: "f.mockEnabledHint" },
					{ field: "mockPort", spec: numberField("mockPort"), kind: "number", labelKey: "f.mockPort", hintKey: "f.mockPortHint", placeholderKey: "p.mockPort" }
				]
			},
			{
				key: "agent",
				fields: [
					{ field: "agentCwd", spec: textField("agentCwd"), kind: "text", labelKey: "f.agentCwd", hintKey: "f.agentCwdHint", placeholderKey: "p.agentCwd" },
					{ field: "agentProvider", spec: textField("agentProvider"), kind: "text", labelKey: "f.agentProvider", hintKey: "f.agentProviderHint", placeholderKey: "p.agentProvider" },
					{ field: "agentModel", spec: textField("agentModel"), kind: "text", labelKey: "f.agentModel", hintKey: "f.agentModelHint", placeholderKey: "p.agentModel" },
					{ field: "agentMaxMessageLength", spec: numberField("agentMaxMessageLength"), kind: "number", labelKey: "f.agentMaxMessageLength", hintKey: "f.agentMaxMessageLengthHint", placeholderKey: "p.agentMaxMessageLength" }
				]
			},
			{
				key: "http",
				fields: [
					{ field: "httpHost", spec: textField("httpHost"), kind: "text", labelKey: "f.httpHost", hintKey: "f.httpHostHint", placeholderKey: "p.httpHost" },
					{ field: "httpPort", spec: numberField("httpPort"), kind: "number", labelKey: "f.httpPort", hintKey: "f.httpPortHint", placeholderKey: "p.httpPort" }
				]
			}
		];

		/** One field, dispatched on its kind. */
		function Field(props) {
			const { spec, kind, labelKey, hintKey, placeholderKey, t, fieldProps, state, onEdit, onReset } = props;
			const common = {
				id: `plugin-config-im-hub-${spec.field}`,
				label: t(labelKey),
				placeholder: placeholderKey ? t(placeholderKey) : "",
				disabled: fieldProps.disabled
			};
			if (kind === "bool") {
				return react_jsx_runtime.jsx(BooleanField, {
					...common,
					hint: t(hintKey),
					inheritLabel: t("f.inherit"),
					onLabel: t("f.on"),
					offLabel: t("f.off"),
					overriddenLabel: t("settings.overridden"),
					resetLabel: t("settings.reset"),
					overridden: state.overridden,
					text: state.text,
					onEdit,
					onReset
				});
			}
			if (kind === "secret") {
				return react_jsx_runtime.jsx(SecretField, {
					...common,
					hint: t(hintKey),
					stateLabel: state.configured ? t("f.configured") : t("f.notConfigured"),
					configured: state.configured,
					text: state.text,
					onEdit,
					onReset
				});
			}
			return react_jsx_runtime.jsx(ValueField, {
				...common,
				hint: t(hintKey),
				numeric: kind === "number",
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				overridden: state.overridden,
				invalid: state.invalid,
				text: state.text,
				onEdit,
				onReset
			});
		}

		/** Render the plugin settings card. */
		function ImHubSettingsCard(props) {
			const { t } = props;
			const state = props.useImHubSettingsCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled
			};
			return react_jsx_runtime.jsx(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: FIELD_GROUPS.map((group) => react_jsx_runtime.jsxs(react.Fragment, {
					key: group.key,
					children: [
						react_jsx_runtime.jsx("p", { className: cssDefault.groupTitle, children: t(`g.${group.key}`) }),
						group.fields.map((entry) => react_jsx_runtime.jsx(Field, {
							spec: entry.spec,
							kind: entry.kind,
							labelKey: entry.labelKey,
							hintKey: entry.hintKey,
							placeholderKey: entry.placeholderKey,
							t,
							fieldProps,
							state: state[entry.field] ?? { text: "", overridden: false, invalid: false, configured: false },
							onEdit: (text) => props.edit(entry.field, text),
							onReset: () => props.resetField(entry.field)
						}, entry.field)),
						react_jsx_runtime.jsx("div", { className: cssDefault.sep })
					]
				}))
			});
		}

		/** Bridges the `im-hub` scope onto the card's staged form. */
		var ImHubSettingsCardController = class {
			constructor(scope) {
				this.form = new CardForm(scope, FIELD_GROUPS.flatMap((group) => group.fields.map((entry) => entry.spec)));
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					...Object.fromEntries(FIELD_GROUPS.flatMap((group) => group.fields.map((entry) => [entry.field, this.form.field(entry.field)])))
				};
			}
			inject() {
				return {
					hooks: { imHubSettingsCard: this.store },
					...this.form.actions()
				};
			}
		};

		// -------------------------------------------------------------- apply
		const NS = "im-hub";
		/** Settings namespace the card edits (the Host plugin registers it). */
		const SETTINGS_NS = "im-hub";
		/** Required client services. */
		const inject = ["slots", "settingsScope", "locale", "connection", "remote"];

		const en = {
			"settings.title": "IM Gateway (dsh-im-hub)",
			"settings.description": "Connect dsh agents to Feishu (Lark), WeCom, and Telegram. Each chat gets its own agent session.",
			"settings.expand": "Expand",
			"settings.collapse": "Collapse",
			"settings.unsaved": "Unsaved changes",
			"settings.readOnly": "This deployment is read-only: settings cannot be changed from the GUI.",
			"settings.overridden": "Override",
			"settings.reset": "Reset",
			"settings.invalidNumber": "Enter a valid number",
			"settings.discard": "Discard",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.saveFailed": "Save failed",
			"g.general": "General",
			"g.telegram": "Telegram",
			"g.feishu": "Feishu (China)",
			"g.lark": "Lark (International)",
			"g.wecom": "WeCom (WeChat Work)",
			"g.mock": "Mock (test)",
			"g.agent": "Agent",
			"g.http": "HTTP (webhook mode)",
			"f.enabled": "Enabled",
			"f.enabledHint": "Master switch for the whole IM gateway.",
			"f.inherit": "Inherit",
			"f.on": "On",
			"f.off": "Off",
			"f.configured": "Configured",
			"f.notConfigured": "Not set",
			"f.secretHint": "Stored server-side; never shown again. Leave blank to keep the current value.",
			"f.telegramEnabled": "Enabled",
			"f.telegramEnabledHint": "Enable the Telegram Bot API long-poll adapter.",
			"f.telegramToken": "Bot token",
			"f.telegramTokenHint": "Token from @BotFather (123456:ABC-DEF…).",
			"f.telegramAllowedUserIds": "Allowed user ids",
			"f.feishuEnabled": "Enabled",
			"f.feishuEnabledHint": "Enable the Feishu WebSocket long-connection adapter (no public URL needed).",
			"f.feishuAppId": "App id",
			"f.feishuAppIdHint": "App id of the Feishu custom app (cli_…).",
			"f.feishuAppSecret": "App secret",
			"f.feishuAllowedUserIds": "Allowed open ids",
			"f.larkEnabled": "Enabled",
			"f.larkEnabledHint": "Enable the international Lark adapter (open.larksuite.com).",
			"f.larkAppId": "App id",
			"f.larkAppSecret": "App secret",
			"f.larkAllowedUserIds": "Allowed open ids",
			"f.wecomEnabled": "Enabled",
			"f.wecomEnabledHint": "Enable the WeCom app-message callback adapter (needs a public URL).",
			"f.wecomCorpId": "Corp id",
			"f.wecomCorpIdHint": "企业ID from the WeCom admin console.",
			"f.wecomCorpSecret": "App secret",
			"f.wecomAgentId": "Agent id",
			"f.wecomAgentIdHint": "Agent id of the WeCom app.",
			"f.wecomToken": "Callback token",
			"f.wecomEncodingAesKey": "EncodingAESKey",
			"f.wecomAllowedUserIds": "Allowed user ids",
			"f.mockEnabled": "Enabled",
			"f.mockEnabledHint": "Test-only adapter: local HTTP endpoint, no platform credentials.",
			"f.mockPort": "Port",
			"f.mockPortHint": "Fixed HTTP port for the mock endpoint (0 = ephemeral).",
			"f.agentCwd": "Working directory",
			"f.agentCwdHint": "cwd for agent sessions; empty = dsh process cwd.",
			"f.agentProvider": "Provider",
			"f.agentProviderHint": "Override model provider; empty = deployment default.",
			"f.agentModel": "Model",
			"f.agentModelHint": "Override model; empty = deployment default.",
			"f.agentMaxMessageLength": "Max message length",
			"f.agentMaxMessageLengthHint": "Max chars per outbound message; longer replies are split.",
			"f.httpHost": "Bind host",
			"f.httpHostHint": "Bind host for webhook-mode HTTP servers.",
			"f.httpPort": "Bind port",
			"f.httpPortHint": "Bind port for webhook-mode HTTP servers.",
			"f.allowedUserIdsHint": "Comma-separated ids; empty = everyone (not recommended for production)."
		};

		const zh = {
			"settings.title": "IM 网关(dsh-im-hub)",
			"settings.description": "把 dsh 智能体接入飞书(Lark)、企业微信、Telegram;每个聊天独立会话。",
			"settings.expand": "展开",
			"settings.collapse": "收起",
			"settings.unsaved": "有未保存的修改",
			"settings.readOnly": "当前部署为只读:GUI 无法修改设置。",
			"settings.overridden": "已覆盖",
			"settings.reset": "重置",
			"settings.invalidNumber": "请输入有效数字",
			"settings.discard": "放弃",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.saveFailed": "保存失败",
			"g.general": "通用",
			"g.telegram": "Telegram",
			"g.feishu": "飞书(国内版)",
			"g.lark": "Lark(国际版)",
			"g.wecom": "企业微信",
			"g.mock": "Mock(测试)",
			"g.agent": "智能体",
			"g.http": "HTTP(webhook 模式)",
			"f.enabled": "启用",
			"f.enabledHint": "整个 IM 网关的总开关。",
			"f.inherit": "继承",
			"f.on": "开",
			"f.off": "关",
			"f.configured": "已配置",
			"f.notConfigured": "未设置",
			"f.secretHint": "凭据仅保存在服务端,不会回显;留空表示保持原值。",
			"f.telegramEnabled": "启用",
			"f.telegramEnabledHint": "启用 Telegram Bot API 长轮询适配器。",
			"f.telegramToken": "Bot Token",
			"f.telegramTokenHint": "来自 @BotFather 的 token(123456:ABC-DEF…)。",
			"f.telegramAllowedUserIds": "允许的用户 id",
			"f.feishuEnabled": "启用",
			"f.feishuEnabledHint": "启用飞书 WebSocket 长连接适配器(无需公网地址)。",
			"f.feishuAppId": "App ID",
			"f.feishuAppIdHint": "飞书自建应用的 App ID(cli_…)。",
			"f.feishuAppSecret": "App Secret",
			"f.feishuAllowedUserIds": "允许的 open_id",
			"f.larkEnabled": "启用",
			"f.larkEnabledHint": "启用 Lark 国际版适配器(open.larksuite.com)。",
			"f.larkAppId": "App ID",
			"f.larkAppSecret": "App Secret",
			"f.larkAllowedUserIds": "允许的 open_id",
			"f.wecomEnabled": "启用",
			"f.wecomEnabledHint": "启用企业微信应用消息回调适配器(需要公网 URL)。",
			"f.wecomCorpId": "企业ID",
			"f.wecomCorpIdHint": "企业微信管理后台的企业ID。",
			"f.wecomCorpSecret": "应用 Secret",
			"f.wecomAgentId": "AgentId",
			"f.wecomAgentIdHint": "企业微信应用的 AgentId。",
			"f.wecomToken": "回调 Token",
			"f.wecomEncodingAesKey": "EncodingAESKey",
			"f.wecomAllowedUserIds": "允许的用户 id",
			"f.mockEnabled": "启用",
			"f.mockEnabledHint": "仅测试用适配器:本地 HTTP 端点,无需平台凭据。",
			"f.mockPort": "端口",
			"f.mockPortHint": "mock 端点固定端口(0 = 随机)。",
			"f.agentCwd": "工作目录",
			"f.agentCwdHint": "agent 会话工作目录;留空 = dsh 进程 cwd。",
			"f.agentProvider": "Provider",
			"f.agentProviderHint": "覆盖模型 provider;留空 = 部署默认。",
			"f.agentModel": "模型",
			"f.agentModelHint": "覆盖模型;留空 = 部署默认。",
			"f.agentMaxMessageLength": "单条消息最大长度",
			"f.agentMaxMessageLengthHint": "单条外发消息最大字符数;超出自动拆分。",
			"f.httpHost": "绑定地址",
			"f.httpHostHint": "webhook 模式 HTTP 服务的绑定地址。",
			"f.httpPort": "绑定端口",
			"f.httpPortHint": "webhook 模式 HTTP 服务的绑定端口。",
			"f.allowedUserIdsHint": "逗号分隔的 id;留空 = 允许所有人(生产环境不建议)。"
		};

		// Examples are shown inside every empty input, so the user can see exactly
		// which value belongs there without having to leave the configuration card.
		const placeholders = {
			en: {
				"p.telegramToken": "Example: 123456789:AA...",
				"p.telegramAllowedUserIds": "Example: 123456789, 987654321",
				"p.feishuAppId": "Example: cli_xxxxxxxxxxxxx",
				"p.feishuAppSecret": "Feishu custom app App Secret",
				"p.feishuAllowedUserIds": "Example: ou_xxxxxxxxxxxxx",
				"p.larkAppId": "Example: cli_xxxxxxxxxxxxx",
				"p.larkAppSecret": "Lark custom app App Secret",
				"p.larkAllowedUserIds": "Example: ou_xxxxxxxxxxxxx",
				"p.wecomCorpId": "Example: wwxxxxxxxxxxxxxx",
				"p.wecomCorpSecret": "WeCom custom app Secret",
				"p.wecomAgentId": "Example: 1000002",
				"p.wecomToken": "Callback URL Token",
				"p.wecomEncodingAesKey": "43-character EncodingAESKey",
				"p.wecomAllowedUserIds": "Example: zhangsan, lisi",
				"p.mockPort": "Example: 9099 (0 = automatic)",
				"p.agentCwd": "Example: D:\\projects\\my-agent (empty = DSH cwd)",
				"p.agentProvider": "Example: volcengine (empty = default)",
				"p.agentModel": "Example: deepseek-v4-flash (empty = default)",
				"p.agentMaxMessageLength": "Example: 4000",
				"p.httpHost": "Example: 0.0.0.0",
				"p.httpPort": "Example: 8080"
			},
			zh: {
				"p.telegramToken": "例如：123456789:AA...",
				"p.telegramAllowedUserIds": "例如：123456789, 987654321",
				"p.feishuAppId": "例如：cli_xxxxxxxxxxxxx",
				"p.feishuAppSecret": "飞书开放平台的 App Secret",
				"p.feishuAllowedUserIds": "例如：ou_xxxxxxxxxxxxx",
				"p.larkAppId": "例如：cli_xxxxxxxxxxxxx",
				"p.larkAppSecret": "Lark 开放平台的 App Secret",
				"p.larkAllowedUserIds": "例如：ou_xxxxxxxxxxxxx",
				"p.wecomCorpId": "例如：wwxxxxxxxxxxxxxx",
				"p.wecomCorpSecret": "企业微信自建应用 Secret",
				"p.wecomAgentId": "例如：1000002",
				"p.wecomToken": "回调 URL 里填写的 Token",
				"p.wecomEncodingAesKey": "43 位 EncodingAESKey",
				"p.wecomAllowedUserIds": "例如：zhangsan, lisi",
				"p.mockPort": "例如：9099（0 = 自动选择）",
				"p.agentCwd": "例如：D:\\projects\\my-agent（留空用 DSH 当前目录）",
				"p.agentProvider": "例如：volcengine（留空用默认）",
				"p.agentModel": "例如：deepseek-v4-flash（留空用默认）",
				"p.agentMaxMessageLength": "例如：4000",
				"p.httpHost": "例如：0.0.0.0",
				"p.httpPort": "例如：8080"
			}
		};

		/**
		 * Mount the settings card.
		 * @param ctx - client root context (slots, settingsScope, locale).
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en: { ...en, ...placeholders.en }, zh: { ...zh, ...placeholders.zh } }), "dsh-im-hub: dictionaries");
			const settingsScope = ctx.settingsScope.bind({ namespace: SETTINGS_NS });
			const card = new ImHubSettingsCardController(settingsScope);
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: SETTINGS_NS,
				id: "dsh-im-hub",
				order: 60,
				locale: NS,
				inject: () => card.inject()
			}, ImHubSettingsCard));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
