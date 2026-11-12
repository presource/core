// src/type/constructor.ts
var e = (e) => e?.constructor, t = /* @__PURE__ */ new WeakMap(), n = (n) => {
	let r = e(n);
	if (r == null) return "";
	let i = t.get(r);
	if (i !== void 0) return i;
	let a = (r?.name || "").toLowerCase();
	return (typeof r == "function" || typeof r == "object") && t.set(r, a), a;
}, r = (t) => e(t) === Boolean, i = (e) => e === !0, a = (e) => e === !1, o = (e) => L(e, {
	number: () => isNaN(e),
	string: () => e.trim() === "",
	array: () => s(e),
	object: () => c(e),
	default: () => !!e
}), s = (e) => {
	let t = !0;
	return z(e, ({ value: e }) => {
		if (!o(e)) return t = !1;
	}), t;
}, c = (e) => {
	let t = !0;
	return S(e, ({ value: e }) => {
		if (!o(e)) return t = !1;
	}), t;
}, l = "function", u = "asyncfunction", d = (e) => {
	let t = n(e);
	return t === l || t === u;
}, f = (e) => n(e) === u, p = (e) => e == null, m = (t) => e(t) === Number, h = (t) => e(t) === Object, g = (t) => e(t) === Promise, _ = (t) => e(t) === String, v = (e) => !p(e), y = (e, t) => new Proxy(e, {
	get: (e, n) => {
		let r = n, i = t.get;
		if (!i) return e[r];
		let a = e[r];
		return i({
			key: r,
			value: a,
			object: e,
			method: "get",
			k: r,
			v: a,
			o: e,
			m: "get"
		});
	},
	set: (e, n, r) => {
		let i = n, a = t.set;
		if (!a) return e[i] = r, !0;
		let o = a({
			key: i,
			value: r,
			object: e,
			method: "set",
			k: i,
			v: r,
			o: e,
			m: "set"
		});
		return p(o) ? !0 : o;
	}
}), ee = (e, t) => {
	let n = Object.create(null);
	Object.keys(t).forEach((e) => {
		n[e] = t[e];
	});
	let r = (e) => n[e] || e;
	return y(e, {
		get: ({ k: t }) => e[r(t)],
		set: ({ k: t, v: n }) => {
			e[r(t)] = n;
		}
	});
}, b = (e, t) => {
	let n = {}, r = -1, i = L(e, {
		number: ({ value: e }) => (r = e > 0 ? Math.floor(e) : 0, []),
		string: () => [e],
		array: () => e,
		default: () => []
	}), a = L(t, {
		function: () => t,
		array: ({ value: e }) => ({ index: t }) => e[t],
		default: () => () => t
	});
	if (r >= 0) for (let e = 0; e < r; e++) n[e] = a({
		value: e,
		index: e
	});
	else i.forEach((e, t) => {
		n[e] = a({
			value: e,
			index: t
		});
	});
	return n;
}, x = (e, t) => {
	let n = Object.keys(e);
	return {
		array: n,
		key: void 0,
		value: void 0,
		index: 0,
		object: e,
		length: n.length,
		result: void 0,
		callback: t
	};
}, S = (e, t) => {
	let n = x(e, t);
	for (; n.index < n.length && (n.key = n.array[n.index], n.value = n.object[n.key], n.result = t(n), n.result === void 0); n.index++);
	return n.result;
}, te = async (e, t) => {
	let n = x(e, t);
	for (; n.index < n.length && (n.key = n.array[n.index], n.value = n.object[n.key], n.result = await t(n), n.result === void 0); n.index++);
	return n.result;
}, ne = (e, t = 0) => e.split(" ").map((e) => {
	if (!e) return e;
	let n = e.length;
	return t < 0 && (t += n), e.slice(0, t) + e.charAt(t).toUpperCase() + e.slice(t + 1);
}).join(" "), re = ({ value: e }) => d(e) ? e : () => e, ie = (e, t) => {
	let n = {}, r = null;
	return S(t, ({ key: i, value: a }) => {
		let o = i.toString();
		e.includes(o) && (r ??= A(t, re), n[o] = d(a) ? a({
			value: e,
			...r
		}) : a);
	}), n;
}, ae = (e) => e.split("").reverse().join(""), C = (e, t) => {
	let n = {};
	for (let e of Object.keys(t)) n[e] = () => w(e, t);
	return n.value = e, n.default = () => t.default, n;
}, w = (e, t) => {
	let n = D(t, e) ? t[e] : t.default;
	return d(n) ? n(C(e, t)) : n;
}, oe = async (e, t) => {
	let n = D(t, e) ? t[e] : t.default;
	return d(n) ? await n(C(e, t)) : n;
}, T = (...e) => {
	if (e.length === 1) {
		let t = e[0], n = typeof t;
		if (n === "string") return t;
		if (n === "number" || n === "boolean") return String(t);
	}
	return w(e.length, {
		0: "",
		1: () => {
			let t = e[0];
			return L(t, {
				object: () => JSON.stringify(t),
				array: () => JSON.stringify(t),
				null: () => "null",
				undefined: () => "undefined",
				default: () => t.toString()
			});
		},
		default: () => e.map((e) => T(e))
	});
}, E = (e) => L(e, {
	function: () => E(e()),
	object: () => e,
	array: () => {
		let t = {};
		return e.forEach((e, n) => {
			t[n] = e;
		}), t;
	},
	undefined: () => ({}),
	default: () => ({ [T(e)]: e })
}), se = /^([^\[]*)((?:\[\d+\])*)$/, ce = /\d+/g, le = (e, t) => {
	let n = t.match(se);
	if (!n) return;
	let [, r, i] = n, a = r ? h(e) ? e[r] : void 0 : e;
	if (i) {
		let e = i.match(ce);
		for (let t of e) {
			if (a === void 0) return;
			a = Array.isArray(a) ? a[Number(t)] : void 0;
		}
	}
	return a ?? void 0;
}, ue = (e, t) => L(t, {
	number: () => {},
	string: ({ value: t }) => {
		let n = e;
		return t.split(".").forEach((e) => {
			n = le(n, e);
		}), n;
	},
	array: ({ value: e, string: t, number: n, array: r }) => e.map((e) => L(e, {
		number: () => n(e),
		string: () => t(e),
		array: () => r(e),
		default: () => void 0
	}))
}), D = (e, t) => e.hasOwnProperty(t), de = (e, t) => (S(t, ({ key: t, value: n }) => {
	D(e, t) || (e[t] = n);
}), { ...e }), fe = (e, t) => {
	let n = {};
	return S(e, (e) => {
		t(e) && (n[e.key] = e.value);
	}), n;
}, O = (e, t, n = { path: [] }) => {
	S(e, (r) => {
		let { value: i, key: a } = r, o = n.path.slice(), s = t({
			...r,
			path: o
		});
		if (s !== void 0 && (e[a] = s), i === e[a] && h(i)) {
			let e = [...o];
			e.push(T(a)), O(i, t, { path: e });
		}
	});
}, k = (e, t) => {
	let n = {};
	return O(e, (e) => {
		let { value: r, key: i, path: a } = e;
		if (!h(r)) {
			i && a.push(i);
			let o = t?.key?.(e) || a.join("."), s = t?.value?.(r) || r;
			n[o] = s;
		}
	}), n;
}, A = (e, t) => {
	let n = {};
	return S(e, (e) => {
		let { key: r } = e;
		n[r] = t(e);
	}), n;
}, pe = (e, t) => {
	let n = {};
	return S(e, (e) => {
		let { key: r, value: i } = e;
		n[t(e) ?? r] = i;
	}), n;
}, j = (...e) => {
	let t = {};
	return e.forEach((e) => {
		S(e, ({ key: e, value: n }) => {
			if (h(n)) {
				let r = t[e];
				t[e] = h(r) ? j(r, n) : n;
			} else t[e] = n;
		});
	}), t;
}, M = (e, t, n = {
	depth: 0,
	path: []
}) => {
	let r = /* @__PURE__ */ new WeakMap(), i = {
		proxy: null,
		depth: n.depth,
		prefix: [...n.path]
	}, a = (e, n) => ({
		get: ({ key: r, value: a, method: s }) => {
			let c = [...n.prefix, r], l = a === void 0 ? {} : a, u = e[r];
			e[r] = l, t({
				key: r,
				value: a,
				current: u,
				object: e,
				method: s,
				depth: n.depth,
				path: c
			});
			let d = e[r];
			if (!h(d)) return d;
			let f = o(d);
			return f !== n && f !== i && (f.prefix = c, f.depth = n.depth + 1), f.proxy;
		},
		set: ({ key: r, value: i, method: a }) => {
			let o = [...n.prefix, r], s = e[r];
			return e[r] = i, t({
				key: r,
				value: i,
				current: s,
				object: e,
				method: a,
				depth: n.depth,
				path: o
			}), !0;
		}
	}), o = (e) => {
		let t = r.get(e);
		if (t) return t;
		let n = {
			proxy: null,
			depth: 0,
			prefix: []
		};
		return r.set(e, n), n.proxy = y(e, a(e, n)), n;
	};
	return i.proxy = y(e, a(e, i)), r.set(e, i), i.proxy;
}, me = (e, t) => {}, N = (e, t) => (t ?? Object.keys(t), Object.assign(e, t), e), he = (e = {}) => {
	let t = (n, r) => L(n, {
		function: ({ value: t }) => t({ each: (t) => S(e, (e) => t(e)) }),
		array: ({ value: t }) => b(t, ({ value: t }) => e[t]),
		number: (e) => e.string(e.value),
		string: ({ value: n }) => r === void 0 ? e[n] : (e[n] = r, t),
		object: ({ value: t }) => N(e, t),
		default: () => e
	});
	return t;
}, ge = (e) => (S(e, ({ key: e, value: t }) => {}), {}), _e = (e) => {
	let t = Object.keys(e), n = {};
	return V(t).forEach((t) => {
		n[t] = e[t];
	}), n;
}, P = (e, t) => {
	let n = t, r = t.default, i = Object.keys(t), a, o = () => {
		if (a) return a;
		a = {};
		for (let e of i) {
			let r = n[e];
			a[e] = () => P({ [e]: r }, t);
		}
		return a;
	}, s = !1, c;
	for (let t of i) {
		if (t === "default" || !D(e, t)) continue;
		s = !0;
		let r = o();
		if (r.value = e[t], r.key = t, c = n[t](r), c !== void 0) break;
	}
	if (s) return c;
	if (r) return r(o());
}, F = (e, t, n = []) => {
	let r = {}, i = Object.keys(t).length;
	e = h(e) ? e : {};
	let a = (t, a) => {
		let o = e[t], s = [{
			key: t,
			value: o,
			input: e,
			output: r
		}].concat(n), c = L(a, {
			function: (e) => e.value(...s),
			object: (e) => F(o, e.value, s),
			default: () => a
		});
		c !== void 0 && (r[t] = c, i--);
	};
	for (; i;) {
		let e = i;
		if (S(t, ({ key: e, value: t }) => {
			D(r, e) || a(e, t);
		}), e === i) break;
	}
	return r;
}, ve = (e, t) => {
	let n = {};
	return S(e, ({ value: r, key: i }) => {
		if (D(t, i)) {
			let a = {
				value: r,
				key: i,
				input: e,
				output: n
			}, o = t[i](a);
			h(o) && N(n, o);
		} else n[i] = r;
	}), n;
}, I = (e) => {
	let t = {};
	return S(e, ({ key: e, value: n }) => {
		let r = t, i = r, a;
		T(e).split(".").forEach((e) => {
			let t = i[e];
			t === void 0 ? i[e] = {} : h(t) || (i[e] = { "": t }), r = i, i = i[e], a = e;
		}), h(n) ? r[a] = j(i, I(n)) : ((e) => {
			let t = i[""], n = t;
			t === void 0 ? n = e : (n = B(t), n.push(e)), i[""] = n;
		})(n);
		let o = Object.keys(i);
		o.length === 1 && o[0] === "" && (r[a] = i[""]);
	}), t;
}, ye = (e) => {
	if (e === void 0) return "undefined";
	if (e === null) return "null";
	let t = n(e);
	return t === "" ? "null" : t;
}, be = (e, t) => (n) => t?.({
	...e,
	value: n
}), L = (e, t) => {
	let n = ye(e), r = D(t, n) ? t[n] : t.default;
	if (!d(r)) return r;
	let i = { value: e }, a = t;
	for (let e of Object.keys(t)) i[e] = be(i, a[e]);
	return r(i);
}, xe = (e) => {
	if (e === void 0) return "undefined";
	if (e === null) return "null";
	let t = n(e);
	return t === "" ? "null" : t;
}, Se = (e, t) => async (n) => t?.({
	...e,
	value: n
}), Ce = async (e, t) => {
	let n = xe(e), r = D(t, n) ? t[n] : t.default;
	if (!d(r)) return r;
	let i = { value: e }, a = t;
	for (let e of Object.keys(t)) i[e] = Se(i, a[e]);
	return await r(i);
}, we = (e) => {
	let t = [];
	return L(e, {
		function: ({ value: e }) => {
			let n = 0;
			for (;;) {
				let r = e({
					index: n,
					value: t[n - 1],
					result: t
				});
				if (r === void 0) break;
				t.push(r), n++;
			}
		},
		number: ({ value: e }) => {
			let n = e > 0 ? Math.floor(e) : 0;
			for (let e = 0; e < n; e++) t.push(void 0);
		}
	}), t;
}, R = (e, t) => ({
	value: void 0,
	index: 0,
	length: e.length,
	callback: t,
	result: void 0
}), z = (e, t) => {
	let n = R(e, t);
	for (; n.index < n.length && (n.value = e[n.index], n.result = t(n), n.result === void 0); n.index++);
	return n.result;
}, Te = async (e, t) => {
	let n = R(e, t);
	for (; n.index < n.length && (n.value = e[n.index], n.result = await t(n), n.result === void 0); n.index++);
	return n.result;
}, B = (e) => L(e, {
	function: () => B(e()),
	undefined: () => [],
	array: () => e,
	default: () => [e]
}), Ee = (e) => (e.length > 0 && e.push(e.shift()), e), V = (e) => {
	let t = e.slice(), n = t.length, r;
	for (; n !== 0;) r = Math.floor(Math.random() * n), n--, [t[n], t[r]] = [t[r], t[n]];
	return t;
}, H = {
	string: _,
	object: h,
	number: m,
	boolean: r,
	invalid: p,
	valid: v,
	null: (e) => e === null,
	undefined: (e) => e === void 0
}, De = () => !0, Oe = (e, t) => {
	let { instance: n } = e, r = 0;
	return n.each(L(t, {
		string: ({ value: e }) => {
			let t = D(H, e) ? H[e] : De;
			return (e) => {
				t(e.value) && r++;
			};
		},
		default: () => () => {
			r++;
		}
	})), r;
}, ke = (e, t) => {
	let { element: n, config: r, instance: i } = e, a = (t) => !z(r.filter || [], ({ value: n }) => {
		if (!n(t, e)) return !0;
	});
	return z(n, (e) => {
		if (a(e)) return t(e);
	}), i;
}, Ae = (e, t) => {
	let { element: n, instance: r } = e;
	return r.keys(t).map((e) => n[e]);
}, U = (e) => {
	for (let t = 0; t < e.length; t++) if (p(e[t])) return !0;
	return !1;
}, je = (e) => {
	for (let t = 0; t < e.length; t++) if (e[t] === void 0) return !0;
	return !1;
}, Me = (e, t) => {
	let { instance: n, element: r, config: i } = e, a = i && i.filter, o = !a || a.length === 0;
	return L(t, {
		string: () => w(t, {
			empty: () => o ? r.length === 0 : n.count() === 0,
			valid: () => o ? !U(r) : n.count("invalid") === 0,
			invalid: ({ valid: e }) => o ? U(r) : !e(),
			filled: ({ empty: e }) => o ? r.length > 0 && !je(r) : !e() && n.count("undefined") === 0,
			default: () => !1
		}),
		default: () => !0
	});
}, Ne = (e, t) => {
	let { instance: n } = e, r = [], i = /* @__PURE__ */ new Set(), a = !1, o = !1, s = !1, c = !1, l = !1, u = !1, d = !1, f = !1, m = (e) => L(e, {
		number: ({ value: e }) => {
			i.add(e), a = !0;
		},
		boolean: ({ value: e }) => {
			e ? d = !0 : f = !0, a = !0;
		},
		string: ({ value: e }) => w(e, {
			valid: () => {
				s = !0, a = !0;
			},
			invalid: () => {
				c = !0, a = !0;
			},
			odd: () => {
				l = !0, a = !0;
			},
			even: () => {
				u = !0, a = !0;
			}
		})
	});
	if (L(t, {
		array: ({ value: e }) => {
			e.forEach(m);
		},
		number: () => m(t),
		string: () => m(t),
		boolean: () => m(t),
		default: () => {
			o = !0;
		}
	}), !o && !a) return r;
	let h = (e, t) => o || l && e % 2 != 0 || u && e % 2 == 0 || d && t || f && !t || c && p(t) || s && !p(t) ? !0 : i.has(e);
	return n.each(({ index: e, value: t }) => {
		h(e, t) && r.push(e);
	}), r;
}, Pe = (e, t) => {
	let { element: n, instance: r } = e, i = r.keys(t);
	if (i.length === 0) return r;
	let a = new Set(i), o = n.length, s = 0;
	for (let e = 0; e < o; e++) if (!a.has(e)) {
		if (s !== e) {
			let t = n[e];
			t !== void 0 || e in n ? n[s] = t : delete n[s];
		}
		s++;
	}
	return n.length = s, r;
}, Fe = (e, t) => {
	let { instance: n } = e, r = [];
	return n.each((e) => {
		t(e) || r.push(e.index);
	}), n.remove(r), n;
}, Ie = (e, t) => {
	let { wrapper: n, element: r, config: i } = e, a = i.filter || [];
	return a.push((e) => L(t, {
		number: ({ value: t }) => t === e.index,
		array: ({ value: e, number: t, string: n, boolean: r }) => z(e, ({ value: e }) => {
			if (L(e, {
				number: () => t(e),
				string: () => n(e),
				boolean: () => r(e)
			})) return !0;
		}),
		default: () => !0
	})), n(r, {
		...i,
		filter: a
	});
}, Le = (e) => {
	let { element: t } = e;
	return t[Math.floor(Math.random() * t.length)];
}, Re = (e = {}) => {
	let t = (n, r = {}) => {
		let i = y(() => null, { get: ({ k: a }) => {
			let o = {
				wrapper: t,
				element: n,
				config: r,
				instance: i
			}, s = {
				get: (e) => Ae(o, e),
				keys: (e) => Ne(o, e),
				is: (e) => Me(o, e),
				count: (e) => Oe(o, e),
				select: (e) => Ie(o, e),
				each: (e) => ke(o, e),
				random: () => Le(o),
				remove: (e) => Pe(o, e),
				retain: (e) => Fe(o, e)
			}, c = e[a];
			return c ? (...e) => {
				let t = c({
					...o,
					args: e
				});
				return p(t) ? i : t;
			} : s[a];
		} });
		return i;
	};
	return t;
}, W = (e, t, n) => {
	let r = {}, i = S(e, ({ key: e, value: i }) => {
		let a = L(i, {
			object: () => n ? n(i) : W(i, t),
			function: () => !!i(r),
			default: () => !!i
		});
		return r[e] = a, t ? t({
			value: a,
			key: e,
			result: r
		}) : void 0;
	});
	return i === void 0 ? r : i;
}, G = (e) => {
	let t = !1;
	return W(e, ({ value: e }) => {
		if (L(e, {
			object: ({ value: e }) => !Object.keys(e).length || G(e),
			default: () => e
		})) return t = !0;
	}), t;
}, ze = (e) => {
	let t = !1;
	return W(e, ({ value: e }) => {
		if (!L(e, {
			object: ({ value: e }) => !Object.keys(e).length || G(e),
			default: () => e
		})) return t = !0;
	}), t;
}, Be = (e) => {
	let t = !0;
	return W(e, ({ value: e }) => {
		if (!e) return t = !1;
	}), t;
}, Ve = (e) => Object.getPrototypeOf(e).constructor, He = (e) => class {
	constructor(...t) {
		S(e, ({ key: e, value: n, index: r }) => {
			let i = t[r];
			this[e] = i === void 0 ? n : i;
		});
	}
}, Ue = (e, t = () => !0) => {
	if (e) return t({ value: e });
}, We = (e, t = () => !0) => {
	if (!e) return t({ value: e });
}, Ge = (e, t) => {
	if (e({ callback: t })) return t({ condition: e });
}, Ke = "", qe = " ", Je = "0123456789", Ye = "abcdefghijklmnopqrstuvwxyz", Xe = "null", Ze = "undefined", K = (e) => {
	if (Array.isArray(e)) return e.map((e) => K(e));
	if (h(e)) {
		let t = {};
		for (let n of Object.keys(e)) t[n] = K(e[n]);
		return t;
	}
	return e;
}, Qe = (e, t) => {
	let n = M(e, ({ method: n, value: r, current: i, path: a }) => {
		if (n === "set") {
			let n = a[0], o = ({ key: r, pointer: a, value: o }) => {
				let s = ue(t, a);
				d(s) && s({
					id: n,
					list: e,
					key: r,
					previous: i,
					value: o
				});
			};
			h(r) ? S(k(r), ({ key: e, value: t }) => {
				let n = a.slice();
				n.push(e);
				let r = a.slice(1);
				r.push(e), o({
					key: n.join("."),
					pointer: r.join("."),
					value: t
				});
			}) : o({
				key: a.join("."),
				pointer: a.slice(1).join("."),
				value: r
			});
		}
	});
	return y(() => e, {
		get: ({ k: e }) => n[e],
		set: ({ k: e, v: t }) => {
			n[e] = t;
		}
	});
}, q = (e) => {
	let t = null, n = !1;
	return new Proxy((...r) => {
		let i = e({
			key: n ? t : null,
			method: "call",
			params: r
		});
		return n = !1, i;
	}, {
		set: (t, n, r) => e({
			key: n,
			method: "set",
			params: Array.isArray(r) ? r : [r]
		}),
		get: (r, i) => (t = i, n = !0, e({
			key: i,
			method: "get",
			params: []
		}) || r)
	});
}, $e = (e) => {
	let t = [], n = 0, r = null, i = null, a = () => {
		t = [], n = 0, r = null;
	}, o = q((s) => w(s.method, {
		call: () => {
			let c = s.params;
			s.key === null ? a() : t.push(r), i && n !== i.index && i.callback(c);
			let l = e({
				chain: t,
				index: n,
				key: r,
				params: c
			});
			return i = null, l || o;
		},
		get: () => (n++, r = s.key, i && i.callback(), i = {
			callback: (...n) => e({
				chain: t,
				index: i.index,
				key: i.key,
				params: n
			}),
			index: n,
			key: r
		}, o)
	}));
	return o;
}, et = /* @__PURE__ */ new Set([
	"name",
	"prototype",
	"displayName"
]), tt = (e) => y(() => e({}), { get: ({ key: t }) => {
	if (!et.has(t)) return e({ key: t });
} }), nt = (e) => {
	let t = (...n) => e.length === n.length ? e(...n) : t.bind(null, ...n);
	return t;
}, J = (e, t = 0) => setTimeout(() => {
	e({ delay: (t) => {
		J(e, t);
	} });
}, t), Y = (e, t) => {
	let n = ((t) => L(t, {
		object: ({ value: e }) => Y(e, r),
		default: () => ({
			reset: () => {
				Object.assign(n, e);
			},
			update: (e) => {
				Object.assign(n, e);
			}
		})
	}));
	Object.assign(n, e);
	let r = y(n, { get: ({ object: e, key: n }) => {
		let r = e[n];
		if (r) return r;
		let i = t?.[n];
		if (i) return i;
	} });
	return r;
}, rt = (...e) => (t, ...n) => {
	let r = e, i = r.length ? r[0](t, ...n) : t;
	for (let e = 1; e < r.length; e++) i = r[e](i);
	return i;
}, X = (e = {}) => {
	let t = {
		queue: [],
		on: e
	}, n = 0, r = !1, i = (e) => {
		t.on.execute?.(e), r = !1, a();
	}, a = () => {
		if (r) return;
		r = !0;
		let { queue: e } = t;
		if (e.length) {
			let { delay: t } = e[0];
			J(() => {
				let t = e.shift();
				if (n = 0, t) {
					let e = t({
						queue: o,
						current: t
					});
					e && g(e) ? e.then((e) => i({
						queue: t,
						response: e
					}), (e) => i({
						queue: t,
						response: void 0,
						error: e
					})) : i({
						queue: t,
						response: e
					});
				}
			}, t || 0);
		} else J(() => {
			Z(t);
		});
	}, o = (e) => e === void 0 ? t : (t.queue.splice(n, 0, e), n++, J(a), {
		delay: (t) => e.delay = t,
		id: (t) => e.id = t
	});
	return N(o, {
		kill: () => Q(t),
		done: () => Z(t)
	}), o;
}, Z = (e) => {
	let t = e.on.complete;
	Q(e), t && t();
}, Q = (e) => {
	N(e, { queue: [] });
}, it = (e = {}) => {
	let t = [], n = [], r = [], i = (e) => {
		if (r.length) {
			let t = r.length - 1, n = r[t];
			n[e] = (n[e] || 0) + 1, r[t] = n;
		}
	}, a = [], o = (e, r) => {
		t[e] !== r && (t[e] = r, a[e].forEach((e) => {
			n[e]?.();
		}));
	};
	return (e) => {
		let s = t.length;
		a[s] = /* @__PURE__ */ new Set();
		let c = L(e, {
			function: ({ value: e }) => (...t) => {
				r.push([]);
				let n = e();
				return S(r.pop(), ({ key: e }) => {
					a[e].add(s);
				}), n;
			},
			default: ({ value: e }) => (t[s] = e, (e) => e === void 0 ? t[s] : e)
		});
		return t[s] = c(), n[s] = q(({ method: e, params: n }) => w(e, { call: () => {
			i(s);
			let e = c(...n);
			return o(s, e), t[s];
		} })), n[s];
	};
}, at = (e) => {
	try {
		return JSON.parse(e);
	} catch {}
	if (e.length === 0) return;
	let t = !1, n = !1, r = [], i = !1, a = !1;
	for (let o = 0; o < e.length; o++) {
		let s = e[o];
		if (n) n = !1;
		else if (s === "\\" && t) n = !0;
		else if (s === "\"") t ? (t = !1, a = !i && r.length > 0 && r[r.length - 1] === "{") : t = !0;
		else if (!t) {
			if (s === ":") {
				i = !0, a = !1;
				continue;
			}
			if (s === "{") {
				r.push(s), i = !1;
				continue;
			}
			if (s === "[") {
				r.push(s), i = !0;
				continue;
			}
			if (s === "}" || s === "]") {
				r.pop();
				continue;
			}
			if (s === ",") {
				i = !(r.length > 0 && r[r.length - 1] === "{");
				continue;
			}
		}
	}
	let o = e;
	for (t && (o += "\""), !t && a && (o += ":\"\""), o.endsWith(",") && (o = o.slice(0, -1)); r.length > 0;) {
		let e = r.pop();
		o += e === "{" ? "}" : "]";
	}
	try {
		return JSON.parse(o);
	} catch {
		return;
	}
}, ot = 256, st = (e) => {
	let t = [], n = null;
	return JSON.stringify(e, function(e, r) {
		if (typeof r != "object" || !r) return r;
		for (; t.length > 0 && t[t.length - 1] !== this;) {
			let e = t.pop();
			n !== null && n.delete(e);
		}
		if (t.length >= ot) {
			if (n ??= new Set(t), n.has(r)) return;
		} else if (t.includes(r)) return;
		return t.push(r), n !== null && n.add(r), r;
	});
}, ct = ((e) => {
	let t = typeof e == "string" ? {
		name: e,
		key: `${e}Id`
	} : e, n = t.memory ?? {
		schema: {
			name: t.name,
			id: t.key
		},
		database: []
	}, r = n.database, i = /* @__PURE__ */ new Map(), a = null, o = (e, t) => e[t], s = () => {
		let e = n.schema.id;
		if (a !== e) {
			i.clear();
			for (let t = 0; t < r.length; t++) {
				let n = o(r[t], e);
				n != null && i.set(n, t);
			}
			a = e;
		}
		return e;
	};
	return {
		memory: () => n,
		config: () => t,
		get: (e) => {
			s();
			let t = i.get(e);
			return t === void 0 ? null : { ...r[t] };
		},
		find: (e) => {
			let t = s(), n = Object.keys(e), a = n.length;
			if (a === 0) return null;
			if (a === 1 && n[0] === t) {
				let n = i.get(e[t]);
				return n === void 0 ? null : { ...r[n] };
			}
			let o = null, c = 0;
			for (let t = 0; t < r.length; t++) {
				let i = r[t], s = 0;
				for (let o = 0; o < a; o++) {
					let l = n[o];
					if (i[l] === e[l]) {
						if (s++, s === a) return { ...r[t] };
					} else if (s + (a - o - 1) <= c) break;
				}
				s > c && (c = s, o = r[t]);
			}
			return o === null ? null : { ...o };
		},
		add: (e) => {
			let n = s(), a = e, o = a[n];
			o ?? (o = crypto.randomUUID(), a[n] = o);
			let c = i.get(o);
			if (c === void 0) return i.set(o, r.length), r.push(e), t.onChange?.(), e;
			let l = {
				...r[c],
				...e
			};
			return r[c] = l, t.onChange?.(), l;
		},
		delete: (e) => {
			let n = s(), a = i.get(e);
			if (a === void 0) return !1;
			let c = r.length - 1;
			if (a !== c) {
				let e = r[c];
				r[a] = e;
				let t = o(e, n);
				t != null && i.set(t, a);
			}
			return r.pop(), i.delete(e), t.onChange?.(), !0;
		}
	};
}), $ = (e, t) => e === t ? e : Array.isArray(e) && Array.isArray(t) ? (t.forEach((t, n) => {
	e[n] = $(e[n], t);
}), e) : h(e) && h(t) ? (S(t, ({ value: t, key: n }) => {
	e[n] = $(e[n], t);
}), e) : t, lt = (e, t, n = 0) => ({
	index: n,
	callback: t,
	length: e,
	count: 0,
	result: void 0
}), ut = (e, t, n = 0) => {
	let r = lt(e, t, n);
	for (; r.index < r.length && (r.result = t(r), r.result === void 0);) r.index++, r.count++;
	return r.result;
}, dt = async (e, t, n = 0) => {
	let r = lt(e, t, n);
	for (; r.index < r.length && (r.result = await t(r), r.result === void 0); r.index++) r.count++;
	return r.result;
}, ft = (e, t) => {
	let n = {
		condition: e,
		callback: t,
		result: void 0,
		count: 0
	};
	for (; !e(n);) {
		let e = t(n);
		if (e !== void 0) break;
		n.count++, n.result = e;
	}
}, pt = (e, t) => {
	let n = {
		condition: e,
		callback: t,
		count: 0,
		result: void 0
	};
	for (; e(n);) {
		let e = t(n);
		if (e !== void 0) break;
		n.count++, n.result = e;
	}
	return n.result;
}, mt = (e) => {
	let t = e ? +e : 0;
	return isNaN(t) ? 0 : t;
}, ht = (e = {}) => new Promise((t, n) => {
	e.resolve = t, e.reject = n;
}), gt = (e = {}) => {
	let t = [], n = {
		append: (e) => (t.push({
			callback: e,
			flags: {
				pending: !0,
				completed: !1
			},
			counter: { retries: 0 }
		}), n),
		process: async (e) => {
			let n = !1, r, i = new Promise((e) => {
				r = e;
			}), a = 0, o = () => {
				n || a === 0 && _t(t) === 0 && r();
			}, s = async (t) => {
				if (n || !t.flags.pending) return;
				a++;
				let i = await t.callback();
				if (a--, !n) {
					if (i !== !1) {
						t.flags.pending = !1, t.flags.completed = !0, t.counter.retries = 0;
						let i = !0;
						if (e?.shouldContinue && (i = await e.shouldContinue()), !i) {
							n = !0, r();
							return;
						}
					} else {
						t.counter.retries++, await new Promise((e) => setTimeout(e, 0)), n || s(t);
						return;
					}
					o();
				}
			};
			(() => {
				let e = t.filter((e) => e.flags.pending);
				e.length === 0 ? r() : e.forEach((e) => s(e));
			})(), await i;
		}
	};
	return n;
}, _t = (e) => e.filter((e) => e.flags.pending).length, vt = (e) => {
	let t = () => null, n = null, r = null, i = A(e, ({ value: e }) => (...i) => (a(), r(async () => {
		await e({
			script: t,
			args: i
		});
	}), n)), a = () => {
		if (n) return;
		let e = {};
		n = ht(e), N(n, i);
		let t = {
			has: !1,
			reason: void 0
		};
		r = X({
			execute: (e) => {
				t.has || e && "error" in e && (t = {
					has: !0,
					reason: e.error
				});
			},
			complete: () => {
				let { resolve: i, reject: a } = e;
				n = null, r = null, t.has ? a(t.reason) : i();
			}
		});
	};
	return N(t, i), t;
}, yt = (e) => new Promise((t) => {
	setTimeout(t, e);
}), bt = async (e, t = 40, n = 50) => {
	let r = { count: 0 };
	return await dt(t, async ({ count: t }) => {
		r.count = t;
		let i = await e(r);
		if (v(i)) return i;
		await yt(n);
	});
}, xt = (e) => {
	let t = Math.floor(e);
	return Number.isNaN(t) || t < 1 ? 1 : t;
}, St = (e = 1) => {
	let t = xt(e), n = [], r = 0, i = 0, a = null, o = () => n.length - r, s = (e) => {
		if (typeof e != "function") return Promise.resolve(e);
		try {
			return Promise.resolve(e());
		} catch (e) {
			return Promise.reject(e);
		}
	}, c = async () => {
		for (; o() > 0 && i < t;) {
			let e = n[r++], t = () => {
				--i, c();
			};
			i += 1, s(e).then(t, t);
		}
		r === n.length && (n.length = 0, r = 0), o() === 0 && i === 0 && a && a();
	};
	return {
		add: (e) => {
			n.push(e), c();
		},
		completion: () => o() === 0 && i === 0 ? Promise.resolve() : new Promise((e) => {
			a = e;
		})
	};
};
export { Ye as ALPHABET_STRING, Ke as EMPTY_STRING, Xe as NULL_STRING, Je as NUMBERS_STRING, qe as SPACE_STRING, Ze as UNDEFINED_STRING, we as arrayCreate, z as arrayEach, Te as arrayEachAsync, B as arrayEnsures, Ee as arrayRequeue, V as arrayShuffle, Re as arrayWrapper, W as booleanCases, ze as booleanPartialFalse, G as booleanPartialTrue, Be as booleanTrue, Ve as classConstructor, He as classCreate, K as dataClone, Qe as dataList, $e as functionChain, tt as functionControl, nt as functionCurry, J as functionDelay, Y as functionOptions, rt as functionPipe, q as functionProxy, X as functionQueue, it as functionState, We as ifFalse, Ge as ifThen, Ue as ifTrue, r as isBoolean, a as isBooleanFalse, i as isBooleanTrue, o as isEmpty, s as isEmptyArray, c as isEmptyObject, d as isFunction, f as isFunctionAsync, p as isInvalid, m as isNumber, h as isObject, g as isPromise, _ as isString, v as isValid, at as jsonComplete, st as jsonStringify, ct as jsonTable, $ as jsonUpdate, ut as loopFor, dt as loopForAsync, ft as loopUntil, pt as loopWhile, mt as numberEnsures, ee as objectAlias, b as objectCreate, S as objectEach, te as objectEachAsync, E as objectEnsures, ue as objectExtract, de as objectFill, fe as objectFilter, k as objectFlatten, D as objectHasKey, A as objectMap, pe as objectMapKeys, j as objectMerge, M as objectObserve, me as objectPopulate, y as objectProxy, he as objectRegistry, ge as objectResolve, O as objectScan, _e as objectShuffle, P as objectSwitch, F as objectTransform, ve as objectTrigger, I as objectUnflatten, N as objectUpdate, ht as promiseCreate, gt as scriptAsync, vt as scriptChain, yt as scriptPause, bt as scriptResolve, ne as stringCapitalize, ie as stringIncludes, ae as stringReverse, w as stringSwitch, oe as stringSwitchAsync, St as taskCompletion, T as toString, e as typeConstructor, n as typeName, L as typeSwitch, Ce as typeSwitchAsync };

//# sourceMappingURL=presource-core.mjs.map