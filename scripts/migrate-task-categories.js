#!/usr/bin/env node

/**
 * Script to migrate existing tasks to add categoryIcon and categoryColor
 * 
 * Usage: node scripts/migrate-task-categories.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = 'tasks-';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

// Task Schema
const taskSchema = new mongoose.Schema({
  categoryId: String,
  categoryName: String,
  categoryIcon: String,
  categoryColor: String,
}, { collection: `${DB_PREFIX}tasks`, strict: false });

// Category Schema
const categorySchema = new mongoose.Schema({
  name: String,
  icon: String,
  color: String,
}, { collection: `${DB_PREFIX}categories` });

async function migrateTasks() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully\n');

    const Task = mongoose.model('Task', taskSchema);
    const Category = mongoose.model('Category', categorySchema);

    // Get all tasks that don't have categoryIcon
    const tasks = await Task.find({
      $or: [
        { categoryIcon: { $exists: false } },
        { categoryIcon: null },
        { categoryIcon: '' }
      ]
    }).lean();

    console.log(`Found ${tasks.length} tasks to migrate\n`);

    let updated = 0;
    let errors = 0;

    for (const task of tasks) {
      try {
        // Find the category
        const category = await Category.findById(task.categoryId);
        
        if (category) {
          await Task.updateOne(
            { _id: task._id },
            {
              $set: {
                categoryIcon: category.icon,
                categoryColor: category.color,
              }
            }
          );
          updated++;
          console.log(`✓ Updated task ${task._id} with category ${category.name}`);
        } else {
          console.warn(`⚠ Category not found for task ${task._id} (categoryId: ${task.categoryId})`);
          errors++;
        }
      } catch (error) {
        console.error(`✗ Error updating task ${task._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log(`  Total tasks: ${tasks.length}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    console.log('='.repeat(50));

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrateTasks();
