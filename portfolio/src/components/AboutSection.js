import React from 'react';

const AboutSection = () => {
  return (
    <section id="about" className="max-w-4xl mx-auto mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">About Me</h2>
        <div className="space-y-4">
          <p className="text-lg text-gray-300">
            I'm a passionate developer with 5+ years of experience creating web applications
            that are both functional and beautiful. My journey in tech started when I built
            my first website at 15, and I've been hooked ever since.
          </p>
          <p className="text-lg text-gray-300">
            I specialize in React, Node.js, and modern JavaScript frameworks, building scalable
            solutions for complex problems. I'm constantly exploring new technologies to 
            stay at the cutting edge of web development.
          </p>
          <p className="text-lg text-gray-300">
            When I'm not coding, you can find me hiking in the mountains, reading sci-fi novels, 
            or experimenting with new recipes in the kitchen. I believe in maintaining a healthy
            work-life balance to fuel creativity and innovation.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;