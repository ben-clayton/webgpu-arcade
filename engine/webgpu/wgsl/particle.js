import { CameraStruct, Rand } from './common.js';

function DrawData(group = 0, binding = 0) {
  return `
[[block]] struct DrawData {
  index_count    : atomic<u32>;
  instance_count : u32;
  first_index    : atomic<u32>;
  base_vertex    : atomic<u32>;
  ignore         : u32;
  vertex_count   : atomic<u32>;
};
[[group(${group}), binding(${binding})]] var<storage, read_write> draw_data : DrawData;
`}

function VertexBuffer(group = 0, binding = 0) {
  return `
struct Vertex {
  position : vec3<f32>;
  alpha    : f32;
  uv       : vec2<f32>;
};

[[block]] struct VertexBuffer {
  v : array<Vertex>;
};

[[group(${group}), binding(${binding})]] var<storage, read_write> vertices : VertexBuffer;
`}

function IndexBuffer(group = 0, binding = 0) {
  return `
[[block]] struct IndexBuffer {
  i : array<u32>;
};

[[group(${group}), binding(${binding})]] var<storage, read_write> indices : IndexBuffer;
`}

export const ParticleVertexSource = `
  ${CameraStruct(0, 0)}

  struct VertexInput {
    [[location(0)]] position_and_alpha : vec4<f32>;
    [[location(1)]] uv                 : vec2<f32>;
  };

  struct VertexOutput {
    [[builtin(position)]] position : vec4<f32>;
    [[location(0)]]       color    : vec4<f32>;
    [[location(1)]]       corner   : vec2<f32>;
  };

  [[stage(vertex)]]
  fn main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    out.position = camera.projection * camera.view * vec4<f32>(in.position_and_alpha.xyz, 1.0);
    out.corner = in.uv * 2.0 - vec2<f32>(1.0);
    out.color = vec4<f32>(1.0) * in.position_and_alpha.a;
    return out;
  }
`;

export const ParticleFragmentSource = `
  struct FragmentInput {
    [[location(0)]] color  : vec4<f32>;
    [[location(1)]] corner : vec2<f32>;
  };

  [[stage(fragment)]]
  fn main(in : FragmentInput) -> [[location(0)]] vec4<f32> {
    var color = in.color;
    return color * smoothStep(1.0, 0.5, length(in.corner));
  }
`;

const SimulationUBOBlock = `
[[block]] struct Simulation {
  rand_seed            : vec2<f32>;
  num_particles        : u32;
  num_can_spawn        : u32;
  delta_time           : f32;
  particle_size_start  : f32;
  particle_size_end    : f32;
  particle_alpha_start : f32;
  particle_alpha_end   : f32;
  spawn_radius         : f32;
  particle_life_from   : f32;
  particle_life_to     : f32;
  matrix               : mat4x4<f32>;
  speed_from           : f32;
  speed_to             : f32;
  spread               : f32;
  gravity              : f32;
  attractor_position   : vec3<f32>;
  attractor_strength   : f32;
  global_velocity      : vec3<f32>;
};

`

export const SIMULATION_WORKGROUP_SIZE = 64;
export const SIMULATION_UNIFORM_BUFFER_SIZE = 64 * 4;
export const PARTICLE_HISTORY = 8;

export const SpriteParticleSimulationSource = `
  ${Rand}
  ${CameraStruct(0, 0)}
  ${DrawData(1, 0)}
  ${VertexBuffer(1, 1)}
  ${IndexBuffer(1, 2)}
  ${SimulationUBOBlock}

struct Particle {
  position          : vec3<f32>;
  age               : f32;
  life_remaining    : f32;
  color             : vec4<f32>;
  velocity          : vec3<f32>;
};

[[block]] struct Particles {
  p : array<Particle>;
};

[[group(1), binding(3)]] var<storage, read_write> particles : Particles;
[[group(1), binding(4)]] var<uniform> sim : Simulation;

var<workgroup> num_particles_spawned : atomic<u32>;

fn drawParticle(particle : Particle, alpha : f32, size : f32) {
  let vertex_idx = atomicAdd(&draw_data.vertex_count, 4u);
  let index_idx = atomicAdd(&draw_data.index_count, 5u);

  let right = camera.right * size;
  let up = camera.up * size;
  let position = particle.position + sim.global_velocity * particle.age;

  vertices.v[vertex_idx + 0u] = Vertex(position - right - up, alpha, vec2<f32>(0.0, 0.0));
  vertices.v[vertex_idx + 1u] = Vertex(position + right - up, alpha, vec2<f32>(1.0, 0.0));
  vertices.v[vertex_idx + 2u] = Vertex(position - right + up, alpha, vec2<f32>(0.0, 1.0));
  vertices.v[vertex_idx + 3u] = Vertex(position + right + up, alpha, vec2<f32>(1.0, 1.0));
  indices.i[index_idx + 0u] = vertex_idx + 0u;
  indices.i[index_idx + 1u] = vertex_idx + 1u;
  indices.i[index_idx + 2u] = vertex_idx + 2u;
  indices.i[index_idx + 3u] = vertex_idx + 3u;
  indices.i[index_idx + 4u] = 0xffffffffu;
}

[[stage(compute), workgroup_size(${SIMULATION_WORKGROUP_SIZE})]]
fn main([[builtin(global_invocation_id)]] global_invocation_id : vec3<u32>) {
  initRand(vec2<f32>(global_invocation_id.xy) + sim.rand_seed);
  let id = global_invocation_id.x;
  if (id >= sim.num_particles) {
    return;
  }

  var particle = particles.p[id];

  let delta_time = sim.delta_time;

  particle.life_remaining = max(particle.life_remaining - delta_time, 0.0);
  particle.age = particle.age + delta_time;

  if (particle.life_remaining <= 0.0) {
    // Dead particle. Should we respawn?
    if (atomicAdd(&num_particles_spawned, 1u) >= sim.num_can_spawn) {
      return; // Can't respawn just yet.
    }

    let offset = normalize(rand_vec3()) * sim.spawn_radius;
    let direction = normalize(mix(vec3<f32>(0.0, 0.0, 1.0), rand_vec3(), sim.spread));
    let speed = mix(sim.speed_from, sim.speed_to, rand());

    particle = Particle();
    particle.life_remaining = mix(sim.particle_life_from, sim.particle_life_to, rand());
    particle.velocity = speed * (sim.matrix * vec4<f32>(direction, 0.0)).xyz;
    particle.position = (sim.matrix * vec4<f32>(offset, 1.0)).xyz;
  }

  var position = particle.position;
  position = position + delta_time * particle.velocity;

  let life_frac = particle.life_remaining / (particle.age + particle.life_remaining);
  let size = mix(sim.particle_size_end, sim.particle_size_start, life_frac);
  let alpha = mix(sim.particle_alpha_end, sim.particle_alpha_start, life_frac) *
              smoothStep(0.0, 0.2, particle.life_remaining);

  // gravity
  particle.velocity.y = particle.velocity.y - sim.gravity * delta_time;

  // attractor
  let attractor_vec = sim.attractor_position - position;
  let attractor_pull = sim.attractor_strength * normalize(attractor_vec);
  particle.velocity = particle.velocity + attractor_pull * delta_time;

  // spin
  // particle.velocity = particle.velocity + cross(position, vec3<f32>(0.0, 0.3, 0.0)) * delta_time;

  particle.position = position;

  drawParticle(particle, alpha, size);

  particles.p[id] = particle;
}
`;

export const TrailParticleSimulationSource = `
  ${Rand}
  ${CameraStruct(0, 0)}
  ${DrawData(1, 0)}
  ${VertexBuffer(1, 1)}
  ${IndexBuffer(1, 2)}
  ${SimulationUBOBlock}

let trail_length = ${PARTICLE_HISTORY}u;

struct PackedTrailRecord {
  position    : vec3<f32>;
  alpha_width : u32;
};

struct TrailRecord {
  position : vec3<f32>;
  alpha    : f32;
  width    : f32;
};

fn unpackTrailRecord(r : PackedTrailRecord) -> TrailRecord {
  let alpha_width = unpack2x16float(r.alpha_width);
  return TrailRecord(r.position, alpha_width.x, alpha_width.y);
}

fn packTrailRecord(r : TrailRecord) -> PackedTrailRecord {
  return PackedTrailRecord(r.position, pack2x16float(vec2<f32>(r.alpha, r.width)));
}

type Trail = array<PackedTrailRecord, trail_length>;

struct Particle {
  trail             : Trail;
  frame             : u32;
  age               : f32;
  life_remaining    : f32;
  trail_parts_alive : u32;
  color             : vec4<f32>;
  velocity          : vec3<f32>;
};

[[block]] struct Particles {
  p : array<Particle>;
};

[[group(1), binding(3)]] var<storage, read_write> particles : Particles;
[[group(1), binding(4)]] var<uniform> sim : Simulation;

var<workgroup> num_particles_spawned : atomic<u32>;

fn drawParticle(trail_let : Trail, frame : u32, age : f32) {
  var trail = trail_let; // WGSL cannot dynamic index on a 'let' array
  var vertex_idx = atomicAdd(&draw_data.vertex_count, trail_length * 2u);
  var index_idx = atomicAdd(&draw_data.index_count, trail_length * 2u + 1u);

  for (var i = 0u; i < trail_length; i = i + 1u) {
    let frac = f32(i) / f32(trail_length - 1u);
    let has_prev = i > 0u;
    let has_next = i < (trail_length - 1u);
    let v = select(0.0, 0.5, has_prev & has_next);
    let prev = (i + frame + 0u) % trail_length;
    let curr = (i + frame + 1u) % trail_length;
    let next = (i + frame + 2u) % trail_length;
    let record   = unpackTrailRecord(trail[curr]);
    let position = record.position + sim.global_velocity * age;
    let alpha    = record.alpha;
    let width    = record.width;
    let dir = select(vec3<f32>(), position - trail[prev].position, has_prev) +
              select(vec3<f32>(), trail[next].position - position, has_next);
    let tangent = normalize(cross(dir, camera.forward)) * width;

    indices.i[index_idx] = vertex_idx;
    vertices.v[vertex_idx] = Vertex(position - tangent, alpha, vec2<f32>(0.0, v));
    index_idx = index_idx + 1u;
    vertex_idx = vertex_idx + 1u;

    indices.i[index_idx] = vertex_idx;
    vertices.v[vertex_idx] = Vertex(position + tangent, alpha, vec2<f32>(1.0, v));
    index_idx = index_idx + 1u;
    vertex_idx = vertex_idx + 1u;
  }
  indices.i[index_idx] = 0xffffffffu;
}

[[stage(compute), workgroup_size(${SIMULATION_WORKGROUP_SIZE})]]
fn main([[builtin(global_invocation_id)]] global_invocation_id : vec3<u32>) {
  initRand(vec2<f32>(global_invocation_id.xy) + sim.rand_seed);
  let id = global_invocation_id.x;
  if (id >= sim.num_particles) {
    return;
  }

  var particle = particles.p[id];

  let delta_time = sim.delta_time;

  particle.life_remaining = max(particle.life_remaining - delta_time, 0.0);
  particle.age = particle.age + delta_time;

  if (particle.trail_parts_alive == 0u) {
    // Dead particle. Should we respawn?
    if (atomicAdd(&num_particles_spawned, 1u) >= sim.num_can_spawn) {
      return; // Can't respawn just yet.
    }

    let offset = normalize(rand_vec3()) * sim.spawn_radius;
    let direction = normalize(mix(vec3<f32>(0.0, 0.0, 1.0), rand_vec3(), sim.spread));
    let speed = mix(sim.speed_from, sim.speed_to, rand());

    particle = Particle();
    particle.life_remaining = mix(sim.particle_life_from, sim.particle_life_to, rand());
    particle.velocity = speed * (sim.matrix * vec4<f32>(direction, 0.0)).xyz;
    particle.trail[0].position = (sim.matrix * vec4<f32>(offset, 1.0)).xyz;
    particle.trail_parts_alive = trail_length;
    particle.frame = 0u;
  }

  if (particle.life_remaining <= 0.0) {
    particle.trail_parts_alive = particle.trail_parts_alive - 1u;
  }

  var position = particle.trail[particle.frame].position;
  particle.frame = (particle.frame + 1u) % trail_length;
  position = position + delta_time * particle.velocity;

  let life_frac = particle.life_remaining / (particle.age + particle.life_remaining);
  let size = mix(sim.particle_size_end, sim.particle_size_start, life_frac);
  let alpha = mix(sim.particle_alpha_end, sim.particle_alpha_start, life_frac) *
              smoothStep(0.0, 0.2, particle.life_remaining);

  // gravity
  particle.velocity.y = particle.velocity.y - sim.gravity * delta_time;

  // attractor
  let attractor_vec = sim.attractor_position - position;
  let attractor_pull = sim.attractor_strength * normalize(attractor_vec);
  particle.velocity = particle.velocity + attractor_pull * delta_time;

  // spin
  // particle.velocity = particle.velocity + cross(position, vec3<f32>(0.0, 0.3, 0.0)) * delta_time;

  // FXC bug workaround: crbug.com/tint/1206
  // particle.trail[particle.frame] = Trail(position, alpha);
  {
    var trail = particle.trail;
    trail[particle.frame] = packTrailRecord(TrailRecord(position, alpha, size));
    particle.trail = trail;
  }

  drawParticle(particle.trail, particle.frame, particle.age);

  particles.p[id] = particle;
}
`;