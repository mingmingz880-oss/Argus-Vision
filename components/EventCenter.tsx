import React, { useState } from 'react';
import { EventLog, EventStatus, AlarmLevel } from '../types';
import { Play, CheckCheck, Eye, X } from 'lucide-react';
import { format } from 'date-fns';

interface EventCenterProps {
  events: EventLog[];
}

export const EventCenter: React.FC<EventCenterProps> = ({ events }) => {
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);

  const getLevelBadge = (level: AlarmLevel) => {
    switch (level) {
      case AlarmLevel.HIGH: return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">HIGH</span>;
      case AlarmLevel.MEDIUM: return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold border border-orange-200">MEDIUM</span>;
      case AlarmLevel.LOW: return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold border border-yellow-200">LOW</span>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="p-4 font-semibold text-gray-600 text-sm border-b">时间</th>
              <th className="p-4 font-semibold text-gray-600 text-sm border-b">等级</th>
              <th className="p-4 font-semibold text-gray-600 text-sm border-b">描述</th>
              <th className="p-4 font-semibold text-gray-600 text-sm border-b">证据</th>
              <th className="p-4 font-semibold text-gray-600 text-sm border-b">状态</th>
              <th className="p-4 font-semibold text-gray-600 text-sm border-b text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map(evt => (
              <tr key={evt.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-sm text-gray-600">{format(new Date(evt.trigger_time), 'yyyy-MM-dd HH:mm:ss')}</td>
                <td className="p-4">{getLevelBadge(evt.alarm_level)}</td>
                <td className="p-4 text-sm font-medium text-gray-800">{evt.description}</td>
                <td className="p-4">
                  <div 
                    className="relative w-16 h-10 bg-gray-200 rounded overflow-hidden cursor-pointer group"
                    onClick={() => setSelectedEvent(evt)}
                  >
                    <img src={evt.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={12} className="text-white fill-current" />
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  {evt.biz_status === EventStatus.PENDING ? (
                    <span className="text-orange-500 text-xs font-medium bg-orange-50 px-2 py-1 rounded">待处理</span>
                  ) : (
                    <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded">已处理</span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2">
                   <button onClick={() => setSelectedEvent(evt)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Eye size={16}/></button>
                   {evt.biz_status === EventStatus.PENDING && (
                     <button className="text-green-600 hover:bg-green-50 p-1.5 rounded"><CheckCheck size={16}/></button>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-gray-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-medium flex items-center space-x-2">
                {getLevelBadge(selectedEvent.alarm_level)} 
                <span>{selectedEvent.description}</span>
              </h3>
              <button onClick={() => setSelectedEvent(null)} className="hover:bg-gray-700 rounded-full p-1"><X size={20}/></button>
            </div>
            
            <div className="flex-1 bg-black relative flex items-center justify-center group">
               {/* Video Player - Updated with muted, playsInline, and reliable source */}
               <video 
                 src="https://videos.pexels.com/video-files/5824632/5824632-hd_1920_1080_24fps.mp4" 
                 poster={selectedEvent.thumbnail}
                 controls 
                 autoPlay 
                 muted
                 playsInline
                 loop
                 className="max-h-[60vh] w-full"
               />
               
               {/* Overlay Simulation */}
               <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded">
                 ROI 叠加层演示
               </div>
            </div>

            <div className="p-6 bg-white border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                触发时间: <span className="font-mono text-gray-800">{format(new Date(selectedEvent.trigger_time), 'yyyy-MM-dd HH:mm:ss')}</span>
              </div>
              <div className="space-x-3">
                 <button 
                   onClick={() => setSelectedEvent(null)}
                   className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                 >
                   忽略
                 </button>
                 <button 
                   onClick={() => {
                     // Logic to update status would go here
                     setSelectedEvent(null);
                   }}
                   className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                 >
                   标记已处理
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};