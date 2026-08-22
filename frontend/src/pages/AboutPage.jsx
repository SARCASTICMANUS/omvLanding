import React from 'react';

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-gray-900">
      <h1 className="text-5xl font-bold mb-6">About Vayy</h1>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">
        Vayy is a modern transit solution designed to simplify your daily commute. 
        We provide real-time tracking, optimized route management, and seamless 
        integration for drivers and passengers alike. Our mission is to make 
        public and private transportation smarter, faster, and more accessible.
      </p>
      <div className="bg-emerald-50 p-8 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4">Our Vision</h2>
        <p className="text-gray-700 leading-relaxed">
          To build the world's most intelligent transit network, reducing congestion 
          and improving the quality of urban life through technology and data-driven insights.
        </p>
      </div>
    </div>
  );
}
