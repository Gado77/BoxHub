# Comandos Úteis e Operações

Abaixo estão os comandos necessários para rodar, testar e empacotar o projeto BoxHub localmente no computador.

---

## 1. Comandos de Desenvolvimento

Navegue até a pasta do projeto:
```powershell
cd "c:\Users\itach\Documents\Segundo Cérebro\Projetos\boxhub"
```

### Iniciar Servidor de Desenvolvimento
Inicia o Next.js localmente com suporte a Fast Refresh (recarregamento automático ao salvar arquivos):
```bash
npm run dev
```
- **Porta padrão:** [http://localhost:3000](http://localhost:3000)

### Validar Integridade e Build de Produção
Compila o TypeScript e empacota todos os arquivos estáticos e rotas de API para verificar se existem erros de sintaxe ou tipos:
```bash
npm run build
```

---

## 2. Limpar Cache do Modo Mock (Local Storage)

Se durante os testes locais você quiser limpar todas as vendas, clientes e configurações criadas no Modo Demonstração para começar do zero:

1. Abra o navegador no painel do BoxHub ([http://localhost:3000](http://localhost:3000)).
2. Pressione **F12** (ou clique com o botão direito e selecione *Inspecionar*).
3. Vá para a aba **Application** (ou *Armazenamento/Aplicativo*).
4. No menu lateral, expanda **Local Storage** e clique no endereço `http://localhost:3000`.
5. Clique com o botão direito nos dados listados e selecione **Clear** (Limpar tudo).
6. Recarregue a página (F5) para iniciar com um banco de dados virtual vazio.

---

## 3. Comandos Relacionados ao Supabase (Opcional)

Se você instalar a CLI do Supabase localmente para rodar o banco de dados docker local:

### Inicializar Supabase Local
```bash
supabase init
```

### Iniciar containers do Supabase
```bash
supabase start
```
