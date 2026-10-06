# Confirmação de email e recuperação de senha

Projeto da plataforma: `rzsciusbrlqvgazizsuq`.

## Situação verificada em 2026-10-06

- O MCP `supabase` agora tem acesso ao banco correto. A migração `add_received_to_events` foi aplicada e verificada, corrigindo a criação de investimentos. O erro era uma coluna inexistente, não uma configuração de Auth.
- O endpoint público de Auth confirma `mailer_autoconfirm: false`: a confirmação de email está ativa.
- Após o usuário disponibilizar o token administrativo no `.env`, as configurações de Auth foram aplicadas pela Management API, sem navegador. A formatação da variável local `SUPABASE_ACCESS_TOKEN` foi normalizada; o arquivo continua ignorado pelo Git e nenhum token foi incluído na documentação.
- **Configuração aplicada e confirmada por GET**: Site URL `https://criptotracker.vercel.app/`; retornos para `https://criptotracker.vercel.app/`, `https://criptotracker.vercel.app` e `https://criptotracker.vercel.app/index.html`; preservado o retorno de desenvolvimento `http://127.0.0.1:8741/index.html`.
- **Modelo de recuperação publicado**: conteúdo exato de `supabase/templates/recovery.html`, com `{{ .Token }}` e `{{ .ConfirmationURL }}`. Assunto: `Recuperar sua senha | Cripto Tracker`. O servidor utiliza OTP de oito dígitos, compatível com o campo de seis a dez dígitos da aplicação. O Supabase atualizou automaticamente o indicador interno de assunto personalizado.
- **Validação**: domínio publicado respondeu HTTP 200 e utiliza o projeto correto; configuração remota corresponde ao modelo local; Auth público mantém `mailer_autoconfirm: false`; API de eventos reconhece `received` (HTTP 200); 22/22 testes de autenticação passaram. Não foi solicitado envio real de emails nem alterada a senha de contas.
- **SMTP preenchido pelo usuário e conferido nesta continuação**: Brevo em `smtp-relay.brevo.com:587`, login, senha e remetente presentes, nome `Cripto Tracker`, limite de 30 emails/h e intervalo de 60 s. Conexão SMTP e STARTTLS com certificado validado passaram. A entrega real de cadastro/recuperação aguarda um email de teste sob controle do usuário; solicitado antes de qualquer envio.
- **Nota para futuras verificações**: `smtp_pass` retornado pela Management API é um marcador de senha armazenada, não a credencial original. O [código oficial do painel](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Auth/SmtpForm/SmtpForm.tsx) trata `SMTP_PASS` como campo somente de escrita. Não usá-lo para autenticar diretamente na Brevo nem reaplicá-lo por PATCH. O teste local que utilizou esse marcador foi descartado como evidência de credenciais inválidas. A validação de envio deve passar pelo próprio Supabase.
- O usuário pediu para não abrir o navegador. Continuação exclusivamente por conector ou terminal.

## Situação verificada em 2026-10-05

- Na verificação inicial, o endpoint público de Auth respondeu com `mailer_autoconfirm: true`. Na nova consulta, após a autorização para aplicar sem SMTP, respondeu com **`mailer_autoconfirm: false`**: a confirmação de email já está ativa no servidor. Essa alteração remota não foi realizada por esta sessão.
- O plugin conectado só disponibiliza `Resposta_Prospeccao_Heitor` (`mpwwmcpmjwwoibtkakht`). A consulta administrativa ao projeto da plataforma retornou falta de permissão.
- O MCP local `supabase` foi cadastrado com o `project_ref` correto e o login OAuth foi concluído. O painel no navegador autenticado também retornou **You do not have access to this project**. É necessário autenticar com a conta que possui o projeto ou adicionar a conta atual à organização correspondente. A URL do MCP não concede permissão à organização por si só.
- As alterações de interface e os fluxos de Auth estão implementados localmente. Esta sessão não alterou configurações remotas nem enviou mensagens de teste para usuários reais. O modelo de recuperação ainda precisa ser aplicado com uma conta autorizada. O usuário deixou a configuração de SMTP para depois.
- Nenhuma migração de tabelas é necessária para estas funcionalidades.

## Referência de configuração

1. Abra o projeto correto: <https://supabase.com/dashboard/project/rzsciusbrlqvgazizsuq>.
2. **Confirm email já está ativo**, conforme o endpoint Auth (`mailer_autoconfirm: false`). A opção fica em **Authentication → Sign In / Providers → Email**.
3. Em **Authentication → URL Configuration**, **Site URL** e **Redirect URLs** já foram configurados para o domínio publicado, preservando o retorno local. A aplicação remove query string e fragmento do endereço enviado como retorno. No APK com assets `file://`, usa o Site URL do Supabase.
4. Em **Authentication → Email Templates → Reset Password**, o conteúdo de [`supabase/templates/recovery.html`](../supabase/templates/recovery.html) já foi publicado. Ele inclui `{{ .Token }}` para o código e preserva `{{ .ConfirmationURL }}` como alternativa por link.
5. **SMTP próprio da Brevo já preenchido**. Configuração e conexão segura foram conferidas; falta validar envio e entrega de emails pelo Supabase com o endereço de teste autorizado.

Enquanto a confirmação automática estiver habilitada no servidor, a nova interface recusa novos cadastros antes de criar a conta e explica que o cadastro está temporariamente indisponível. Isso evita criar mais contas já confirmadas. Logins de contas existentes com email confirmado continuam funcionando. Contas confirmadas automaticamente anteriormente não são desconfirmadas por esta mudança.

O botão **Esqueci minha senha** suporta código e link de recuperação. O modelo que fornece ambas as opções já está publicado no Supabase.

## Validação após configurar e publicar

- Criar uma conta com um email de teste controlado: a tela deve permanecer no login, com mensagem de confirmação e opção de reenvio.
- Tentar entrar antes de confirmar: o servidor deve recusar o login.
- Confirmar pelo email e entrar; conferir que abrir o link em outra aba funciona mesmo sem a opção de lembrar ativada.
- Recuperar a senha: solicitar email, testar código incorreto/expirado e depois usar um código válido para definir a nova senha. Após salvar, entrar com a nova senha.
- Testar também o link de recuperação: deve abrir o formulário de nova senha antes de carregar a carteira.
- Recarregar durante a recuperação: deve continuar no formulário. Se o encerramento da sessão falhar após salvar a senha, **Concluir recuperação** tenta apenas o encerramento, sem repetir a atualização da senha. A sessão de recuperação usa armazenamento separado por aba.
- Testar Donate no desktop e em Configurações no celular, incluindo a cópia de ambas as chaves.

Documentação oficial: [autenticação por senha](https://supabase.com/docs/guides/auth/passwords), [modelos de email](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
