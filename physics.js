/* A rigid sphere in a chamber attached to the phone. SI units; fixed-step solver. */
(function (root) {
  'use strict';
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length = a => Math.hypot(...a);
  function limit(a, max) { const n=length(a); return n>max ? a.map(x=>x*max/n) : a.slice(); }
  function apparentAcceleration(specificForce, omega, angularAcceleration, position, velocity) {
    // Accelerometer specific force f = a_origin - g. Thus g - a_origin = -f.
    // Rotating-frame terms: Coriolis, centrifugal, Euler. All vectors in phone frame.
    const coriolis=cross(omega,velocity), centrifugal=cross(omega,cross(omega,position)), euler=cross(angularAcceleration,position);
    return specificForce.map((f,i)=>-f-2*coriolis[i]-centrifugal[i]-euler[i]);
  }
  function rotationVector(rate) {
    // DeviceMotion rotationRate: alpha about X, beta about Y, gamma about Z.
    // These are body-axis rates, NOT DeviceOrientationEvent's Euler angle order.
    // Mapping follows the current W3C motion specification and MDN rotationRate.
    const d=Math.PI/180;
    return [rate.alpha*d,rate.beta*d,rate.gamma*d];
  }
  class Chamber {
    constructor() { this.bounds=[1.45,1.85,1.15];this.radius=.18;this.restitution=.3;this.friction=.16;this.reset(); }
    reset() { this.position=[0,-.2,0];this.velocity=[0,0,0]; }
    step(dt,specificForce,omega=[0,0,0],angularAcceleration=[0,0,0]) {
      if (!(dt>0 && dt<=1/30)) throw new RangeError('Use a fixed step of 1/30 second or less.');
      const acceleration=limit(apparentAcceleration(specificForce,omega,angularAcceleration,this.position,this.velocity),60);
      const drag=Math.exp(-.22*dt);
      this.velocity=limit(this.velocity.map((v,i)=>(v+acceleration[i]*dt)*drag),10);
      this.position=this.position.map((p,i)=>p+this.velocity[i]*dt);
      let impact=0;
      for(let axis=0;axis<3;axis++) {
        const extent=this.bounds[axis]-this.radius;
        if(Math.abs(this.position[axis])<=extent) continue;
        const side=Math.sign(this.position[axis]);
        this.position[axis]=side*extent;
        if(this.velocity[axis]*side<=0) continue;
        const normalSpeed=Math.abs(this.velocity[axis]);
        impact=Math.max(impact,normalSpeed);
        const bounce=normalSpeed>.22 ? this.restitution : 0;
        const impulse=(1+bounce)*normalSpeed;
        this.velocity[axis]*=-bounce;
        const tangentSpeed=Math.hypot(...this.velocity.filter((_,i)=>i!==axis));
        const frictionScale=tangentSpeed>0 ? Math.max(0,1-this.friction*impulse/tangentSpeed) : 0;
        this.velocity=this.velocity.map((v,i)=>i===axis?v:v*frictionScale);
      }
      return impact;
    }
  }
  const api={cross,length,limit,apparentAcceleration,rotationVector,Chamber};
  root.GravityPhysics=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(globalThis);
