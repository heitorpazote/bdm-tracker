# Confirmação de email e recuperação de senha

Projeto da plataforma: `rzsciusbrlqvgazizsuq`.

## Situação verificada em 2026-10-05

- Na verificação inicial, o endpoint público de Auth respondeu com `mailer_autoconfirm: true`. Na nova consulta, após a autorização para aplicar sem SMTP, respondeu com **`mailer_autoconfirm: false`**: a confirmação de email já está ativa no servidor. Essa alteração remota não foi realizada por esta sessão.
- O plugin conectado só disponibiliza `Resposta_Prospeccao_Heitor` (`mpwwmcpmjwwoibtkakht`). A consulta administrativa ao projeto da plataforma retornou falta de permissão.
- O MCP local `supabase` foi cadastrado com o `project_ref` correto e o login OAuth foi concluído. O painel no navegador autenticado também retornou **You do not have access to this project**. É necessário autenticar com a conta que possui o projeto ou adicionar a conta atual à organização correspondente. A URL do MCP não concede permissão à organização por si só.
- As alterações de interface e os fluxos de Auth estão implementados localmente. Esta sessão não alterou configurações remotas nem enviou mensagens de teste para usuários reais. O modelo de recuperação ainda precisa ser aplicado com uma conta autorizada. O usuário deixou a configuração de SMTP para depois.
- Nenhuma migração de tabelas é necessária para estas funcionalidades.

## Configuração necessária no painel

1. Abra o projeto correto: <https://supabase.com/dashboard/project/rzsciusbrlqvgazizsuq>.
2. **Confirm email já está ativo**, conforme o endpoint Auth (`mailer_autoconfirm: false`). A opção fica em **Authentication → Sign In / Providers → Email**.
3. Em **Authentication → URL Configuration**, configure **Site URL** com o endereço HTTPS publicado da plataforma e inclua o endereço da página em **Redirect URLs**. Para desenvolvimento, inclua `http://127.0.0.1:8741/index.html` apenas se for usá-lo. A aplicação remove query string e fragmento do endereço enviado como retorno. No APK com assets `file://`, usa o Site URL do Supabase.
4. Em **Authentication → Email Templates → Reset Password**, use o conteúdo de [`supabase/templates/recovery.html`](../supabase/templates/recovery.html). Ele inclui `{{ .Token }}` para o código e preserva `{{ .ConfirmationURL }}` como alternativa por link.
5. Verifique a configuração de envio de emails. Se estiver usando o remetente padrão restrito do Supabase, configure SMTP próprio para enviar aos emails dos usuários da plataforma.

Enquanto a confirmação automática estiver habilitada no servidor, a nova interface recusa novos cadastros antes de criar a conta e explica que o cadastro está temporariamente indisponível. Isso evita criar mais contas já confirmadas. Logins de contas existentes com email confirmado continuam funcionando. Contas confirmadas automaticamente anteriormente não são desconfirmadas por esta mudança.

O botão **Esqueci minha senha** já suporta o link padrão do Supabase. Para receber e digitar o código na plataforma, também é necessário publicar o modelo de recuperação indicado acima.

## Validação após configurar e publicar

- Criar uma conta com um email de teste controlado: a tela deve permanecer no login, com mensagem de confirmação e opção de reenvio.
- Tentar entrar antes de confirmar: o servidor deve recusar o login.
- Confirmar pelo email e entrar; conferir que abrir o link em outra aba funciona mesmo sem a opção de lembrar ativada.
- Recuperar a senha: solicitar email, testar código incorreto/expirado e depois usar um código válido para definir a nova senha. Após salvar, entrar com a nova senha.
- Testar também o link de recuperação: deve abrir o formulário de nova senha antes de carregar a carteira.
- Recarregar durante a recuperação: deve continuar no formulário. Se o encerramento da sessão falhar após salvar a senha, **Concluir recuperação** tenta apenas o encerramento, sem repetir a atualização da senha. A sessão de recuperação usa armazenamento separado por aba.
- Testar Donate no desktop e em Configurações no celular, incluindo a cópia de ambas as chaves.

Documentação oficial: [autenticação por senha](https://supabase.com/docs/guides/auth/passwords), [modelos de email](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
