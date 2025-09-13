Decisions
---

This document serves to record design decisions to try and share historical context as the project evolves.

## 5/*/2022

###  Using CJS modules instead of ESM modules

who: @nicktomlin

Moving to ESM would mean potentially breaking compatability with folks on modern versions of node who have not switched to ESM and additional overhead in maintaining both systems. Some library authors have decided to simply [convert to ESM wholesale](https://blog.sindresorhus.com/get-ready-for-esm-aa53530b3f77).

I would suggest we maintain CJS compat for now, in the hope that there's either better tooling for "dual publishing" or enough momentum behind ESM that publishing a breaking ESM-only version does not cause too much churn for users.

Because it's relatively simple to support interop between ESM and CJS, and the wide footprint.


### Using `node-fetch`

who: @nicktomlin

I initially explored [`undici`](https://github.com/nodejs/undici) as a way of using the built-in `fetch` support in node.

Unfortunately, at the time of writing there's no clean way to handle `tls` options. Additionally, `fetch` is experimental for node 16.x which results in warnings.

At some point in the future, it would be nice to migrate over once undici's `fetch` implementation is a little more feature rich and things have stabalized.


### Using `jest` for testing

`jest` can be a little magical, but it's relatively fast (with 28.x especially), ergonomic, and provides a simple maintenance story over a BYO setup.

I considered `mocha` and `ava` (which i've also used and like) but `jest` struck the best balance between simplicity and feature-set at the moment.

### Using `tsup` to publish

who: @nicktomlin

Typescript publication can be a wacky process and `tsup` simplifies a lot of this.

### More Docs

* [Getting Started](getting-started.md)
* [Create and run task workers](workers.md)
* [Create Workflows](create.md)
* [Execute Workflows](execute.md)
* [Search for entities](search.md)

