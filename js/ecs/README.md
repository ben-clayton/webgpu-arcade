# Entity Component System

A fork of [ECSY](https://ecsy.io/) with a bunch of my own modifications. Changes include:

  - Added SingletonComponent
  - vector property type
  - Ability to add multiple components as JSON blocks
  - Renamed a bunch of methods to be more concise. Examples:
    - getComponent() -> read()
    - getMutableComponent() -> modify()
    - addComponent() -> add()