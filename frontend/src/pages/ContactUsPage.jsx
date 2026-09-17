import React from 'react';

export default function ContactUsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-5xl font-bold text-gray-900 mb-6">Support</h1>
      <p className="text-lg text-gray-600 mb-12">
        Need assistance? Our team is here to help you get the most out of OMV.
      </p>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Contact Information</h2>
          <p className="text-gray-600 mb-2">Email: info@onmyvayy.com</p>
          <p className="text-gray-600">LinkedIn: linkedin.com/company/onmyvayy</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Office Hours</h2>
          <p className="text-gray-600 mb-2">Mon - Fri: 9:00 AM - 6:00 PM</p>
          <p className="text-gray-600">Sat - Sun: Closed</p>
          <p className="text-gray-400 text-sm mt-4">We typically respond within 24 hours</p>
        </div>
      </div>
    </div>
  );
}
