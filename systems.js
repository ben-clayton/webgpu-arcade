import {System, Not } from './third-party/ecsy/src/index.js';
import { Player, PlayerBullet, Dead, Transform, Velocity, Collider, Health,
         Damage, Lifespan, Polygon, CanvasContext } from './components.js';
import { vec2 } from './third-party/gl-matrix/dist/esm/index.js'

//-----------------------
// Systems
//-----------------------

export class MovableSystem extends System {
  static queries = {
    moving: { components: [Velocity, Transform] }
  };

  execute(delta, time) {
    const canvas = this.getSingletonComponent(CanvasContext).canvas;

    this.queries.moving.results.forEach(entity => {
      const vel = entity.getComponent(Velocity);
      const trans = entity.getMutableComponent(Transform);

      vec2.scaleAndAdd(trans.position, trans.position, vel.direction, delta);
      trans.orientation += vel.angular * delta;

      if (trans.position[0] > canvas.width) { trans.position[0] = 0; }
      if (trans.position[0] < 0) { trans.position[0] = canvas.width; }
      if (trans.position[1] > canvas.height) { trans.position[1] = 0; }
      if (trans.position[1] < 0) { trans.position[1] = canvas.height; }
    });
  }
}

export class DamageSystem extends System {
  static queries = {
    damagable: { components: [Health, Transform, Collider, Not(Dead)] },
    damaging: { components: [Damage, Transform, Collider] }
  };

  execute(delta, time) {
    const damagables = this.queries.damagable.results;

    this.queries.damaging.results.forEach(src => {
      const srcTrans = src.getComponent(Transform);
      const srcCollider = src.getComponent(Collider);
      const damage = src.getComponent(Damage);

      for (const dst of damagables) {
        // Never damage yourself.
        if (dst == src) { continue; }

        // Skip if target is immune to this type of damage
        if (dst.hasAnyComponents(damage.immune)) { continue; }

        // Don't beat dead horses.
        const health = dst.getMutableComponent(Health);
        if (health <= 0) { continue; }

        const dstTrans = dst.getComponent(Transform);
        const dstCollider = dst.getComponent(Collider);

        const distSq = vec2.sqrDist(srcTrans.position, dstTrans.position);

        let damageDistSq = dstCollider.radius + srcCollider.radius;
        damageDistSq = damageDistSq * damageDistSq;

        if (damageDistSq >= distSq) {
          health.value -= damage.value;

          if (health.value <= 0) {
            dst.addComponent(Dead);
          }
        }
      }
    });
  }
}

export class DeathSystem extends System {
  static queries = {
    lifespan: { components: [Lifespan, Not(Dead)] },
    dead: { components: [Dead] }
  };

  execute(delta, time) {
    this.queries.lifespan.results.forEach(entity => {
      let lifespan = entity.getMutableComponent(Lifespan);
      lifespan.value -= delta;
      if (lifespan.value <= 0) {
        entity.addComponent(Dead);
      }
    });

    // Bring out your dead!
    let dead = this.queries.dead.results;
    // Important to iterate in reverse order
    for (var i = dead.length - 1; i >= 0; i--) {
      // Just remove for now, later can do things like explode. :)
      dead[i].remove();
    }
  }
}

export class RenderingSystem extends System {
  static queries = {
    renderable: { components: [Polygon, Transform] }
  };

  init(attributes) {
    const canvasContext = this.getMutableSingletonComponent(CanvasContext);
    if (!canvasContext.ctx) {
      canvasContext.ctx = canvasContext.canvas.getContext("2d");
    }
  }

  execute(delta, time) {
    const cc = this.getSingletonComponent(CanvasContext);
    const canvas = cc.canvas;
    const ctx = cc.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#d4d4d4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.queries.renderable.results.forEach(entity => {
      const polygon = entity.getComponent(Polygon);
      const trans = entity.getComponent(Transform);

      ctx.setTransform(1, 0, 0, 1, trans.position[0], trans.position[1]);
      ctx.rotate(trans.orientation);

      ctx.beginPath();

      if (polygon.points.length) {
        ctx.moveTo(polygon.points[0], polygon.points[1]);
        for (let i = 2; i < polygon.points.length-1; i+=2) {
          ctx.lineTo(polygon.points[i], polygon.points[i+1]);
        }
        ctx.lineTo(polygon.points[0], polygon.points[1]);
      } else {
        const collider = entity.getComponent(Collider);
        ctx.arc(0, 0, collider ? collider.radius : 5.0, 0, 2 * Math.PI, false);
        //ctx.rect(-5, -5, 10, 10);
      }

      ctx.fillStyle = polygon.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = polygon.stroke;
      ctx.stroke();
    });
  }
}

export class InputSystem extends System {
  static queries = {
    player: { components: [Player] }
  };

  init() {
    // Keyboard listener
    this.pressedKeys = new Array(128);
    window.addEventListener('keydown', (event) => {
      this.pressedKeys[event.keyCode] = true;
    });
    window.addEventListener('keyup', (event) => {
      this.pressedKeys[event.keyCode] = false;
    });
  }

  fireBullet(entity) {
    let trans = entity.getComponent(Transform);
    let speed = 500;
    let bullet = this.world.createEntity()
      .addComponent(Transform, { position: trans.position })
      .addComponent(Velocity, {
        direction: [Math.cos(trans.orientation) * speed,
                    Math.sin(trans.orientation) * speed]
      })
      .addComponent(Damage, { value: 1, immune: [Player] })
      .addComponent(Health, { value: 1 })
      .addComponent(Lifespan, { value: 1 })
      .addComponent(Polygon, { fill: "#FFFF77", stroke: "#FFFF99" })
      .addComponent(Collider, { radius: 1 })
      .addComponent(PlayerBullet);
  }

  execute(delta, time) {
    this.queries.player.results.forEach(entity => {
      const trans = entity.getMutableComponent(Transform);
      const vel = entity.getMutableComponent(Velocity);

      const dir = [0, 0];

      if (this.pressedKeys['D'.charCodeAt(0)]) {
        dir[0] += 1;
      }
      if (this.pressedKeys['A'.charCodeAt(0)]) {
        dir[0] -= 1;
      }
      if (this.pressedKeys['S'.charCodeAt(0)]) {
        dir[1] += 1;
      }
      if (this.pressedKeys['W'.charCodeAt(0)]) {
        dir[1] -= 1;
      }

      if (dir[0] || dir[1]) {
        vec2.scaleAndAdd(vel.direction, vel.direction, dir, 100.0 * delta);

        const speed = vec2.length(vel.direction);
        if (speed > vel.maxSpeed) {
          vec2.scale(vel.direction, vel.direction, vel.maxSpeed / speed);
        }

        const targetOrientation = Math.atan2(dir[1], dir[0]);
        let orientationDelta = targetOrientation - trans.orientation;
        trans.orientation += ( targetOrientation - trans.orientation ) * 0.1;
      }

      // Fire bullets
      if (this.pressedKeys[' '.charCodeAt(0)]) {
        this.fireBullet(entity);
      }
    });
  }
}