import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shiftCalendarMonth,weekOffsetForMonth,calendarViewForKey,calendarPosition} from './calendar-period.js';
test('month navigation from a 31st reaches February, without mutating selected date',()=>{
 const selected=new Date(2026,2,31);const previous=shiftCalendarMonth(selected,-1);
 assert.equal(previous.getMonth(),1);assert.equal(previous.getDate(),1);assert.equal(selected.getDate(),31);
});
test('month navigation crosses years in either direction',()=>{
 assert.equal(shiftCalendarMonth(new Date(2026,0,31),-1).getFullYear(),2025);
 assert.equal(shiftCalendarMonth(new Date(2026,11,31),1).getFullYear(),2027);
});
test('week view matches the last week touching a historical month, including leap February',()=>{
 for(const year of [2024,2025,2026])for(let month=0;month<12;month++){
  const today=new Date(2027,0,15);const end=new Date(year,month+1,0);const offset=weekOffsetForMonth(end,today);
  const monday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-(today.getDay()+6)%7+offset*7);
  const sunday=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+6,23,59,59);
  assert.ok(monday<=end && sunday>=end,`${year}-${month+1}`);
 }
});
test('current or future month returns the current week, never a future week',()=>{
 const today=new Date(2026,8,11);assert.equal(weekOffsetForMonth(new Date(2026,8,1),today),0);
 assert.equal(weekOffsetForMonth(new Date(2026,9,1),today),0);
});

test('calendar tabs support horizontal arrows and Home/End without taking vertical scrolling',()=>{
 assert.equal(calendarViewForKey('week','ArrowRight'),'month');
 assert.equal(calendarViewForKey('month','ArrowRight'),'week');
 assert.equal(calendarViewForKey('month','ArrowLeft'),'week');
 assert.equal(calendarViewForKey('week','End'),'month');
 assert.equal(calendarViewForKey('month','Home'),'week');
 for(const key of ['ArrowDown','ArrowUp','PageDown','Tab']) assert.equal(calendarViewForKey('week',key),null);
 assert.equal(calendarViewForKey('invalid','ArrowRight'),null);
});


test('calendar rings explain actual day position, including leap month and past or future views',()=>{
 assert.deepEqual(calendarPosition(new Date(2026,8,1),new Date(2026,8,11)),{day:11,total:30,progress:11/30*100});
 assert.equal(calendarPosition(new Date(2024,1,1),new Date(2024,1,29)).total,29);
 assert.equal(calendarPosition(new Date(2026,7,1),new Date(2026,8,11)).progress,100);
 assert.equal(calendarPosition(new Date(2026,9,1),new Date(2026,8,11)).progress,0);
 assert.deepEqual(calendarPosition(new Date(2026,8,7),new Date(2026,8,11),true),{day:5,total:7,progress:5/7*100});
 assert.equal(calendarPosition(new Date(2026,2,23),new Date(2026,2,29),true).day,7);
});
