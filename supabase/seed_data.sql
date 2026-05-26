-- ============================================================
-- BOXHUB - DADOS DE TESTE (Produtos, Clientes e Vendas)
-- ============================================================
-- Só copiar e colar no SQL Editor do Supabase e rodar
-- ============================================================

-- ========================================
-- CONFIGURAÇÃO DOS IDs (JÁ PREENCHIDOS)
-- ========================================
do $$
declare
  v_org_id uuid := '8dbbe719-2d17-41ad-bcb8-abe97e8b99fc'::uuid;
  v_seller_id uuid := '7d0f678a-fccd-4226-85b9-7ae9b434e78c'::uuid;
  v_prod record;
  v_cli record;
  v_sale_id uuid;
  v_cli_ids uuid[] := '{}'::uuid[];
  v_prod_names text[] := '{}'::text[];
begin

-- ========================================
-- 1. PRODUTOS (Frutas e Legumes)
-- ========================================
insert into public.products (organization_id, name, description, type, status, stock_quantity) values
  (v_org_id, 'Maracujá', 'Caixa de maracujá selecionado', 'fruta', 'active', 120),
  (v_org_id, 'Goiaba Vermelha', 'Caixa de goiaba vermelha gigante', 'fruta', 'active', 80),
  (v_org_id, 'Mamão Formosa', 'Caixa de mamão doce da Bahia', 'fruta', 'active', 60),
  (v_org_id, 'Mamão Papaia', 'Caixa de mamão papaia selecionado', 'fruta', 'active', 45),
  (v_org_id, 'Laranja Pera', 'Caixa de laranja pera selecionada', 'fruta', 'active', 200),
  (v_org_id, 'Laranja Lima', 'Caixa de laranja lima', 'fruta', 'active', 150),
  (v_org_id, 'Banana Prata', 'Banana prata tipo 1', 'fruta', 'active', 100),
  (v_org_id, 'Banana Nanica', 'Banana nanica tipo 1', 'fruta', 'active', 90),
  (v_org_id, 'Maçã Fuji', 'Caixa de maçã fuji importada', 'fruta', 'active', 70),
  (v_org_id, 'Maçã Gala', 'Caixa de maçã gala nacional', 'fruta', 'active', 65),
  (v_org_id, 'Uva Rubi', 'Caixa de uva rubi sem semente', 'fruta', 'active', 40),
  (v_org_id, 'Uva Thompson', 'Caixa de uva thompson', 'fruta', 'active', 35),
  (v_org_id, 'Melancia', 'Melancia graúda tipo 1', 'fruta', 'active', 25),
  (v_org_id, 'Melão', 'Caixa de melão amarelo', 'fruta', 'active', 50),
  (v_org_id, 'Abacaxi', 'Caixa de abacaxi pérola', 'fruta', 'active', 55),
  (v_org_id, 'Limão Tahiti', 'Caixa de limão tahiti selecionado', 'fruta', 'active', 110),
  (v_org_id, 'Manga Tommy', 'Caixa de manga tommy atkins', 'fruta', 'active', 75),
  (v_org_id, 'Manga Palmer', 'Caixa de manga palmer', 'fruta', 'active', 60),
  (v_org_id, 'Pêra Williams', 'Caixa de pêra williams', 'fruta', 'active', 30),
  (v_org_id, 'Ameixa', 'Caixa de ameixa nacional', 'fruta', 'active', 25);

insert into public.products (organization_id, name, description, type, status, stock_quantity) values
  (v_org_id, 'Cenoura', 'Saco de cenoura selecionada 20kg', 'legume', 'active', 80),
  (v_org_id, 'Batata Monalisa', 'Saco de batata escovada especial 25kg', 'legume', 'active', 150),
  (v_org_id, 'Batata Doce', 'Saco de batata doce rosada 20kg', 'legume', 'active', 60),
  (v_org_id, 'Cebola', 'Saco de cebola nacional 20kg', 'legume', 'active', 90),
  (v_org_id, 'Tomate Caqui', 'Caixa de tomate caqui selecionado', 'legume', 'active', 70),
  (v_org_id, 'Tomate Cereja', 'Bandeja de tomate cereja 250g', 'legume', 'active', 100),
  (v_org_id, 'Alface Crespa', 'Caixa com 12 unidades', 'legume', 'active', 40),
  (v_org_id, 'Couve', 'Maço de couve manteiga', 'legume', 'active', 50),
  (v_org_id, 'Abóbora Japonesa', 'Caixa de abóbora japonesa (kabotiá)', 'legume', 'active', 35),
  (v_org_id, 'Chuchu', 'Caixa de chuchu selecionado', 'legume', 'active', 45),
  (v_org_id, 'Beterraba', 'Saco de beterraba selecionada 20kg', 'legume', 'active', 40),
  (v_org_id, 'Brócolis', 'Caixa de brócolis ramoso', 'legume', 'active', 30),
  (v_org_id, 'Espinafre', 'Maço de espinafre fresco', 'legume', 'active', 25),
  (v_org_id, 'Vagem', 'Caixa de vagem macarrão', 'legume', 'active', 35),
  (v_org_id, 'Pimentão Verde', 'Caixa de pimentão verde selecionado', 'legume', 'active', 30);

-- ========================================
-- 2. VARIANTES
-- ========================================
for v_prod in select id, name from public.products where organization_id = v_org_id and name in ('Maracujá', 'Goiaba Vermelha', 'Laranja Pera', 'Manga Tommy', 'Batata Monalisa', 'Cenoura', 'Tomate Caqui') loop

  if v_prod.name = 'Maracujá' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Da Bahia', 50), (v_prod.id, 'Do Sul', 40), (v_prod.id, 'Da Grande', 30);
  end if;

  if v_prod.name = 'Goiaba Vermelha' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Vermelha', 50), (v_prod.id, 'Branca', 30);
  end if;

  if v_prod.name = 'Laranja Pera' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Bahia', 100), (v_prod.id, 'Mineira', 60), (v_prod.id, 'Paulista', 40);
  end if;

  if v_prod.name = 'Manga Tommy' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Extra', 40), (v_prod.id, 'Primeira', 35);
  end if;

  if v_prod.name = 'Batata Monalisa' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Lavada', 90), (v_prod.id, 'Suja', 60);
  end if;

  if v_prod.name = 'Cenoura' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Média', 50), (v_prod.id, 'Graúda', 30);
  end if;

  if v_prod.name = 'Tomate Caqui' then
    insert into public.product_variants (product_id, name, stock_quantity) values
      (v_prod.id, 'Extra', 40), (v_prod.id, 'Primeira', 30);
  end if;

end loop;

-- ========================================
-- 3. CLIENTES
-- ========================================
insert into public.clients (organization_id, name, type, contact, fiado_limit) values
  (v_org_id, 'Quitanda do João', 'quitanda', '(11) 99888-7701', 1500.00),
  (v_org_id, 'Restaurante Bom Sabor', 'restaurante', '(11) 97777-6601', 3500.00),
  (v_org_id, 'Mercado Estrela', 'mercado', '(11) 96666-5501', 5000.00),
  (v_org_id, 'Sacolão do Zé', 'quitanda', '(11) 95555-4401', 2000.00),
  (v_org_id, 'Restaurante Caseiro', 'restaurante', '(11) 94444-3301', 2500.00),
  (v_org_id, 'Mercado São João', 'mercado', '(11) 93333-2201', 6000.00),
  (v_org_id, 'Feira Verde', 'quitanda', '(11) 92222-1101', 1800.00),
  (v_org_id, 'Pizzaria do Chef', 'restaurante', '(11) 91111-0001', 1200.00),
  (v_org_id, 'Supermercado Box', 'mercado', '(11) 90000-9901', 8000.00),
  (v_org_id, 'Quitanda da Dona Maria', 'quitanda', '(11) 98888-7702', 1000.00),
  (v_org_id, 'Restaurante Sabor da Roça', 'restaurante', '(11) 97777-6602', 2200.00),
  (v_org_id, 'Açougue do Tonho', 'outro', '(11) 96666-5502', 800.00),
  (v_org_id, 'Mercado Minipreço', 'mercado', '(11) 95555-4402', 4000.00),
  (v_org_id, 'Hortifruti Natural', 'quitanda', '(11) 94444-3302', 3000.00),
  (v_org_id, 'Lanchonete do Point', 'restaurante', '(11) 93333-2202', 900.00);

-- ========================================
-- 4. VENDAS
-- ========================================

-- Helper function inline: pega ID do cliente pelo nome
-- Venda 1 - Quitanda do João - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 320.00, 'pix', 'pago', now() - interval '55 days'
  from public.clients where name = 'Quitanda do João' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 80.00, 320.00
  from public.products where name = 'Maracujá' and organization_id = v_org_id;

-- Venda 2 - Restaurante Bom Sabor - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 525.00, 'dinheiro', 'pago', now() - interval '52 days'
  from public.clients where name = 'Restaurante Bom Sabor' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 85.00, 255.00 from public.products where name = 'Mamão Formosa' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 90.00, 270.00 from public.products where name = 'Laranja Lima' and organization_id = v_org_id;

-- Venda 3 - Mercado Estrela - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 890.00, 'fiado', 'pendente', now() - interval '48 days'
  from public.clients where name = 'Mercado Estrela' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 55.00, 550.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 68.00, 340.00 from public.products where name = 'Cenoura' and organization_id = v_org_id;

-- Venda 4 - Sacolão do Zé - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 410.00, 'pix', 'pago', now() - interval '45 days'
  from public.clients where name = 'Sacolão do Zé' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 42.00, 210.00 from public.products where name = 'Banana Prata' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 50.00, 200.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;

-- Venda 5 - Restaurante Caseiro - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 725.00, 'pix', 'pago', now() - interval '42 days'
  from public.clients where name = 'Restaurante Caseiro' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 45.00, 225.00 from public.products where name = 'Goiaba Vermelha' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 75.00, 300.00 from public.products where name = 'Mamão Papaia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 50.00, 200.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;

-- Venda 6 - Mercado São João - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 1560.00, 'fiado', 'pendente', now() - interval '40 days'
  from public.clients where name = 'Mercado São João' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 12, 55.00, 660.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 90.00, 900.00 from public.products where name = 'Tomate Caqui' and organization_id = v_org_id;

-- Venda 7 - Feira Verde - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 280.00, 'dinheiro', 'pago', now() - interval '38 days'
  from public.clients where name = 'Feira Verde' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 50.00, 150.00 from public.products where name = 'Maçã Fuji' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 65.00, 130.00 from public.products where name = 'Abacaxi' and organization_id = v_org_id;

-- Venda 8 - Pizzaria do Chef - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 190.00, 'pix', 'pago', now() - interval '35 days'
  from public.clients where name = 'Pizzaria do Chef' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 45.00, 90.00 from public.products where name = 'Limão Tahiti' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 50.00, 100.00 from public.products where name = 'Tomate Cereja' and organization_id = v_org_id;

-- Venda 9 - Supermercado Box - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 2350.00, 'pix', 'pago', now() - interval '33 days'
  from public.clients where name = 'Supermercado Box' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 80.00, 800.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 15, 55.00, 825.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 72.50, 725.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;

-- Venda 10 - Quitanda da Dona Maria - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 165.00, 'dinheiro', 'pago', now() - interval '30 days'
  from public.clients where name = 'Quitanda da Dona Maria' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 80.00, 160.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;

-- Venda 11 - Restaurante Sabor da Roça - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 680.00, 'fiado', 'pendente', now() - interval '28 days'
  from public.clients where name = 'Restaurante Sabor da Roça' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 85.00, 340.00 from public.products where name = 'Mamão Formosa' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 42.00, 168.00 from public.products where name = 'Banana Prata' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 43.00, 172.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 12 - Açougue do Tonho - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 340.00, 'pix', 'pago', now() - interval '26 days'
  from public.clients where name = 'Açougue do Tonho' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 65.00, 195.00 from public.products where name = 'Abacaxi' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 72.50, 145.00 from public.products where name = 'Vagem' and organization_id = v_org_id;

-- Venda 13 - Mercado Minipreço - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 1250.00, 'pix', 'pago', now() - interval '24 days'
  from public.clients where name = 'Mercado Minipreço' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 55.00, 550.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 8, 38.00, 304.00 from public.products where name = 'Banana Nanica' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 66.00, 396.00 from public.products where name = 'Cebola' and organization_id = v_org_id;

-- Venda 14 - Hortifruti Natural - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 920.00, 'fiado', 'pendente', now() - interval '22 days'
  from public.clients where name = 'Hortifruti Natural' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 80.00, 400.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 45.00, 270.00 from public.products where name = 'Goiaba Vermelha' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 62.50, 250.00 from public.products where name = 'Cenoura' and organization_id = v_org_id;

-- Venda 15 - Quitanda do João - pix (recorrente)
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 480.00, 'pix', 'pago', now() - interval '20 days'
  from public.clients where name = 'Quitanda do João' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 85.00, 255.00 from public.products where name = 'Mamão Formosa' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 75.00, 225.00 from public.products where name = 'Manga Tommy' and organization_id = v_org_id;

-- Venda 16 - Restaurante Bom Sabor - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 690.00, 'pix', 'pago', now() - interval '18 days'
  from public.clients where name = 'Restaurante Bom Sabor' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 75.00, 375.00 from public.products where name = 'Mamão Papaia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 105.00, 315.00 from public.products where name = 'Uva Rubi' and organization_id = v_org_id;

-- Venda 17 - Mercado Estrela - pix (pagou fiado)
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 1150.00, 'pix', 'pago', now() - interval '16 days'
  from public.clients where name = 'Mercado Estrela' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 8, 90.00, 720.00 from public.products where name = 'Laranja Lima' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 50.00, 300.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 43.33, 130.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 18 - Sacolão do Zé - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 560.00, 'pix', 'pago', now() - interval '14 days'
  from public.clients where name = 'Sacolão do Zé' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 50.00, 200.00 from public.products where name = 'Maçã Fuji' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 90.00, 270.00 from public.products where name = 'Melancia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 90.00, 90.00 from public.products where name = 'Melão' and organization_id = v_org_id;

-- Venda 19 - Restaurante Caseiro - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 385.00, 'dinheiro', 'pago', now() - interval '12 days'
  from public.clients where name = 'Restaurante Caseiro' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 45.00, 135.00 from public.products where name = 'Maçã Gala' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 50.00, 250.00 from public.products where name = 'Tomate Cereja' and organization_id = v_org_id;

-- Venda 20 - Mercado São João - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 1840.00, 'fiado', 'pendente', now() - interval '10 days'
  from public.clients where name = 'Mercado São João' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 15, 55.00, 825.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 8, 70.00, 560.00 from public.products where name = 'Manga Palmer' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 75.83, 455.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;

-- Venda 21 - Feira Verde - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 350.00, 'pix', 'pago', now() - interval '8 days'
  from public.clients where name = 'Feira Verde' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 75.00, 225.00 from public.products where name = 'Manga Tommy' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 62.50, 125.00 from public.products where name = 'Cenoura' and organization_id = v_org_id;

-- Venda 22 - Pizzaria do Chef - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 255.00, 'pix', 'pago', now() - interval '6 days'
  from public.clients where name = 'Pizzaria do Chef' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 80.00, 160.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 47.50, 95.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 23 - Supermercado Box - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 3120.00, 'pix', 'pago', now() - interval '5 days'
  from public.clients where name = 'Supermercado Box' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 85.00, 850.00 from public.products where name = 'Mamão Formosa' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 12, 90.00, 1080.00 from public.products where name = 'Laranja Lima' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 66.00, 660.00 from public.products where name = 'Cebola' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 7, 75.71, 530.00 from public.products where name = 'Vagem' and organization_id = v_org_id;

-- Venda 24 - Quitanda da Dona Maria - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 210.00, 'dinheiro', 'pago', now() - interval '4 days'
  from public.clients where name = 'Quitanda da Dona Maria' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 70.00, 210.00 from public.products where name = 'Abacaxi' and organization_id = v_org_id;

-- Venda 25 - Restaurante Sabor da Roça - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 520.00, 'fiado', 'pendente', now() - interval '3 days'
  from public.clients where name = 'Restaurante Sabor da Roça' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 45.00, 180.00 from public.products where name = 'Goiaba Vermelha' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 45.00, 135.00 from public.products where name = 'Limão Tahiti' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 41.00, 205.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 26 - Açougue do Tonho - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 290.00, 'pix', 'pago', now() - interval '2 days'
  from public.clients where name = 'Açougue do Tonho' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 45.00, 135.00 from public.products where name = 'Limão Tahiti' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 77.50, 155.00 from public.products where name = 'Pimentão Verde' and organization_id = v_org_id;

-- Venda 27 - Mercado Minipreço - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 980.00, 'pix', 'pago', now() - interval '1 day'
  from public.clients where name = 'Mercado Minipreço' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 8, 55.00, 440.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 50.00, 300.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 80.00, 240.00 from public.products where name = 'Tomate Caqui' and organization_id = v_org_id;

-- Venda 28 - Hortifruti Natural - pix (pagou fiado)
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 760.00, 'pix', 'pago', now() - interval '12 hours'
  from public.clients where name = 'Hortifruti Natural' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 75.00, 375.00 from public.products where name = 'Mamão Papaia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 50.00, 200.00 from public.products where name = 'Maçã Fuji' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 46.25, 185.00 from public.products where name = 'Tomate Cereja' and organization_id = v_org_id;

-- Venda 29 - Lanchonete do Point - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 145.00, 'dinheiro', 'pago', now() - interval '6 hours'
  from public.clients where name = 'Lanchonete do Point' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 65.00, 65.00 from public.products where name = 'Abacaxi' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 40.00, 80.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 30 - Quitanda do João - pix (agora)
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 560.00, 'pix', 'pago', now() - interval '3 hours'
  from public.clients where name = 'Quitanda do João' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 80.00, 320.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 120.00, 240.00 from public.products where name = 'Uva Rubi' and organization_id = v_org_id;

-- Venda 31 - Mercado Estrela - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 1320.00, 'fiado', 'pendente', now() - interval '1 hour'
  from public.clients where name = 'Mercado Estrela' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 12, 55.00, 660.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 72.50, 435.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 75.00, 225.00 from public.products where name = 'Vagem' and organization_id = v_org_id;

-- Venda 32 - Restaurante Bom Sabor - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 610.00, 'pix', 'pago', now() - interval '25 days'
  from public.clients where name = 'Restaurante Bom Sabor' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 45.00, 225.00 from public.products where name = 'Maçã Gala' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 90.00, 180.00 from public.products where name = 'Melancia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 50.00, 150.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 55.00, 55.00 from public.products where name = 'Pimentão Verde' and organization_id = v_org_id;

-- Venda 33 - Supermercado Box - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 2100.00, 'fiado', 'pendente', now() - interval '15 days'
  from public.clients where name = 'Supermercado Box' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 80.00, 800.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 10, 90.00, 900.00 from public.products where name = 'Laranja Lima' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 6, 66.67, 400.00 from public.products where name = 'Cebola' and organization_id = v_org_id;

-- Venda 34 - Feira Verde - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 295.00, 'dinheiro', 'pago', now() - interval '28 days'
  from public.clients where name = 'Feira Verde' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 55.00, 165.00 from public.products where name = 'Ameixa' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 43.33, 130.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 35 - Sacolão do Zé - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 720.00, 'fiado', 'pendente', now() - interval '7 days'
  from public.clients where name = 'Sacolão do Zé' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 75.00, 375.00 from public.products where name = 'Manga Tommy' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 62.50, 250.00 from public.products where name = 'Cenoura' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 47.50, 95.00 from public.products where name = 'Tomate Cereja' and organization_id = v_org_id;

-- Venda 36 - Restaurante Caseiro - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 550.00, 'pix', 'pago', now() - interval '35 days'
  from public.clients where name = 'Restaurante Caseiro' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 38.00, 190.00 from public.products where name = 'Banana Nanica' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 65.00, 260.00 from public.products where name = 'Abacaxi' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 50.00, 100.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 37 - Hortifruti Natural - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 540.00, 'dinheiro', 'pago', now() - interval '44 days'
  from public.clients where name = 'Hortifruti Natural' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 45.00, 225.00 from public.products where name = 'Goiaba Vermelha' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 45.00, 135.00 from public.products where name = 'Limão Tahiti' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 60.00, 180.00 from public.products where name = 'Cebola' and organization_id = v_org_id;

-- Venda 38 - Mercado São João - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 920.00, 'pix', 'pago', now() - interval '50 days'
  from public.clients where name = 'Mercado São João' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 90.00, 450.00 from public.products where name = 'Melancia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 70.00, 350.00 from public.products where name = 'Manga Palmer' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 60.00, 120.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;

-- Venda 39 - Mercado Minipreço - fiado
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 650.00, 'fiado', 'pendente', now() - interval '19 days'
  from public.clients where name = 'Mercado Minipreço' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 105.00, 315.00 from public.products where name = 'Uva Rubi' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 75.00, 225.00 from public.products where name = 'Manga Tommy' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 55.00, 110.00 from public.products where name = 'Tomate Caqui' and organization_id = v_org_id;

-- Venda 40 - Lanchonete do Point - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 175.00, 'pix', 'pago', now() - interval '9 days'
  from public.clients where name = 'Lanchonete do Point' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 90.00, 90.00 from public.products where name = 'Melão' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 2, 42.50, 85.00 from public.products where name = 'Tomate Cereja' and organization_id = v_org_id;

-- Venda 41 - Restaurante Bom Sabor - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 780.00, 'pix', 'pago', now() - interval '44 days'
  from public.clients where name = 'Restaurante Bom Sabor' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 42.00, 168.00 from public.products where name = 'Banana Prata' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 110.00, 330.00 from public.products where name = 'Uva Thompson' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 70.50, 282.00 from public.products where name = 'Cenoura' and organization_id = v_org_id;

-- Venda 42 - Supermercado Box - pix (grande compra)
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 4480.00, 'pix', 'pago', now() - interval '55 days'
  from public.clients where name = 'Supermercado Box' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 25, 55.00, 1375.00 from public.products where name = 'Laranja Pera' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 20, 90.00, 1800.00 from public.products where name = 'Laranja Lima' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 15, 66.00, 990.00 from public.products where name = 'Cebola' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 5, 63.00, 315.00 from public.products where name = 'Maracujá' and organization_id = v_org_id;

-- Venda 43 - Quitanda da Dona Maria - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 185.00, 'pix', 'pago', now() - interval '55 days'
  from public.clients where name = 'Quitanda da Dona Maria' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 42.00, 126.00 from public.products where name = 'Banana Prata' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 59.00, 59.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- Venda 44 - Feira Verde - pix
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 440.00, 'pix', 'pago', now() - interval '46 days'
  from public.clients where name = 'Feira Verde' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 75.00, 225.00 from public.products where name = 'Mamão Papaia' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 4, 50.00, 200.00 from public.products where name = 'Batata Doce' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 15.00, 15.00 from public.products where name = 'Limão Tahiti' and organization_id = v_org_id;

-- Venda 45 - Pizzaria do Chef - dinheiro
v_sale_id := gen_random_uuid();
insert into public.sales (id, organization_id, client_id, seller_id, total_amount, payment_method, status, created_at)
  select v_sale_id, v_org_id, id, v_seller_id, 230.00, 'dinheiro', 'pago', now() - interval '58 days'
  from public.clients where name = 'Pizzaria do Chef' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 1, 105.00, 105.00 from public.products where name = 'Uva Rubi' and organization_id = v_org_id;
insert into public.sale_items (sale_id, product_id, quantity, price_per_box, total_price)
  select v_sale_id, id, 3, 41.67, 125.00 from public.products where name = 'Beterraba' and organization_id = v_org_id;

-- ========================================
-- 5. PAGAMENTOS FIADO (amortizações)
-- ========================================
insert into public.fiado_payments (organization_id, client_id, amount, payment_method, created_at)
  select v_org_id, id, 400.00, 'pix', now() - interval '40 days'
  from public.clients where name = 'Mercado Estrela' and organization_id = v_org_id;

insert into public.fiado_payments (organization_id, client_id, amount, payment_method, created_at)
  select v_org_id, id, 500.00, 'dinheiro', now() - interval '32 days'
  from public.clients where name = 'Mercado São João' and organization_id = v_org_id;

insert into public.fiado_payments (organization_id, client_id, amount, payment_method, created_at)
  select v_org_id, id, 300.00, 'pix', now() - interval '3 days'
  from public.clients where name = 'Sacolão do Zé' and organization_id = v_org_id;

raise notice '✅ Dados de teste inseridos com sucesso!';
end $$;
