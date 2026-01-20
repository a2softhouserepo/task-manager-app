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

async function migrate() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado com sucesso.\n');

    // Buscar ou criar a categoria "Template de e-mail"
    let templateCategory = await Category.findOne({ 
      name: 'Template de e-mail',
      active: true 
    });

    if (!templateCategory) {
      console.log('⚠️  Categoria "Template de e-mail" não encontrada.');
      console.log('🔄 Criando categoria "Template de e-mail"...\n');
      
      templateCategory = await Category.create({
        name: 'Template de e-mail',
        icon: '📧',
        active: true
      });
      
      console.log('✅ Categoria criada com sucesso!');
    } else {
      console.log('✅ Categoria encontrada:');
    }
    
    console.log(`   Nome: ${templateCategory.name}`);
    console.log(`   ID: ${templateCategory._id}`);
    console.log(`   Ícone: ${templateCategory.icon}\n`);

    // Buscar todas as tasks com os categoryName que precisam ser atualizados
    const oldCategoryNames = ['E-mail', 'E-mail MKT', 'E-mkt'];
    
    const tasksToUpdate = await Task.find({
      categoryName: { $in: oldCategoryNames }
    });

    console.log(`📊 Encontradas ${tasksToUpdate.length} tarefas para atualizar:\n`);

    // Mostrar resumo por categoria antiga
    const countByOldCategory = {};
    tasksToUpdate.forEach(task => {
      countByOldCategory[task.categoryName] = (countByOldCategory[task.categoryName] || 0) + 1;
    });

    for (const [oldName, count] of Object.entries(countByOldCategory)) {
      console.log(`   "${oldName}": ${count} tarefas`);
    }
    console.log('');

    if (tasksToUpdate.length === 0) {
      console.log('✅ Nenhuma tarefa precisa ser atualizada.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Atualizar todas as tasks
    console.log('🔄 Atualizando tarefas...\n');

    const updateResult = await Task.updateMany(
      { categoryName: { $in: oldCategoryNames } },
      {
        $set: {
          categoryName: templateCategory.name,
          categoryId: templateCategory._id,
          categoryIcon: templateCategory.icon
        }
      }
    );

    console.log('✅ Atualização concluída!');
    console.log(`   Tarefas modificadas: ${updateResult.modifiedCount}`);
    console.log(`   Tarefas correspondentes: ${updateResult.matchedCount}\n`);

    // Mostrar exemplos das tarefas atualizadas
    const updatedTasks = await Task.find({
      categoryName: templateCategory.name,
      categoryId: templateCategory._id
    }).limit(5);

    console.log('📋 Exemplos de tarefas atualizadas:');
    updatedTasks.forEach((task, index) => {
      console.log(`   ${index + 1}. ${task.title?.substring(0, 50)}`);
      console.log(`      Categoria: ${task.categoryName} | ID: ${task.categoryId} | Ícone: ${task.categoryIcon}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();
