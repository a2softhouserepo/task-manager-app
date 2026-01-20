require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

// Schema para Category
const categorySchema = new mongoose.Schema({
  name: String,
  icon: String,
  active: Boolean
}, { collection: `${DB_PREFIX}categories`, timestamps: true });

// Schema para Task
const taskSchema = new mongoose.Schema({
  categoryName: String,
  categoryId: mongoose.Schema.Types.ObjectId,
  categoryIcon: String,
  title: String
}, { collection: `${DB_PREFIX}tasks`, strict: false });

const Category = mongoose.model('Category', categorySchema);
const Task = mongoose.model('Task', taskSchema);

async function updateIcons() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado com sucesso.\n');

    const categoriesToUpdate = ['Sustentação', 'Conteúdo'];
    let totalUpdated = 0;

    for (const categoryName of categoriesToUpdate) {
      console.log(`📋 Processando categoria: "${categoryName}"`);
      
      // Buscar a categoria no banco
      const category = await Category.findOne({ 
        name: categoryName,
        active: true 
      });

      if (!category) {
        console.log(`   ⚠️  Categoria "${categoryName}" não encontrada no banco.\n`);
        continue;
      }

      console.log(`   ✅ Categoria encontrada:`);
      console.log(`      ID: ${category._id}`);
      console.log(`      Ícone: ${category.icon}`);

      // Contar tarefas que precisam ser atualizadas
      const tasksCount = await Task.countDocuments({
        categoryName: categoryName
      });

      console.log(`   📊 Tarefas encontradas: ${tasksCount}`);

      if (tasksCount === 0) {
        console.log(`   ℹ️  Nenhuma tarefa para atualizar.\n`);
        continue;
      }

      // Atualizar as tarefas
      const updateResult = await Task.updateMany(
        { categoryName: categoryName },
        {
          $set: {
            categoryId: category._id,
            categoryIcon: category.icon
          }
        }
      );

      console.log(`   ✅ Atualizado: ${updateResult.modifiedCount} tarefas\n`);
      totalUpdated += updateResult.modifiedCount;
    }

    // Mostrar exemplos de tarefas atualizadas
    console.log('📋 Exemplos de tarefas atualizadas:\n');
    
    for (const categoryName of categoriesToUpdate) {
      const tasks = await Task.find({ categoryName: categoryName }).limit(3);
      if (tasks.length > 0) {
        console.log(`   ${categoryName}:`);
        tasks.forEach(task => {
          console.log(`      • ${task.title?.substring(0, 50)} | Ícone: ${task.categoryIcon}`);
        });
        console.log('');
      }
    }

    console.log(`✅ Migração concluída! Total de tarefas atualizadas: ${totalUpdated}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

updateIcons();
