import React from 'react';

const AboutSection = () => {
  return (
    <section id="about" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">About Me</h2>
        <div className="space-y-4">
          <p className="text-lg text-gray-300">
            I am a 3rd year student currently enrolled on the MEng Integrated Masters Computer Science course at Durham University. 
            I have over 3 years of experience working in Software Development, especially with the Microsoft Power Platform for business applications.
          </p>
          <p className="text-lg text-gray-300">
            I’ve worked with a variety of programming languages to create multiple projects which you can see below. 
            Some have been for work purposes, university related and personal projects.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;