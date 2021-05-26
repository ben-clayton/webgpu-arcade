# ECSY-cute

A fork of [ECSY](https://ecsy.io/) with a bunch of my own modifications. Yes,
the name is a terrible pun.

Changes include:
  - Added SingletonComponent
  - vector/matrix property types
  - Ability to add multiple components as JSON blocks
  - Renamed a bunch of methods to be more concise. Examples:
    - getComponent() -> read()
    - getMutableComponent() -> modify()
    - addComponent() -> add()