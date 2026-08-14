migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const storesCol = app.findCollectionByNameOrId('stores')
    const brandsCol = app.findCollectionByNameOrId('brands')
    const skusCol = app.findCollectionByNameOrId('skus')
    const promotersCol = app.findCollectionByNameOrId('promoters')
    const rulesCol = app.findCollectionByNameOrId('audit_rules')

    // Helper to find or create user
    function getOrCreateUser(email, name, role) {
      try {
        return app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {
        const u = new Record(usersCol)
        u.setEmail(email)
        u.setPassword('Skip@Pass')
        u.setVerified(true)
        u.set('name', name)
        u.set('role', role)
        u.set('active', true)
        app.save(u)
        return u
      }
    }

    // 1. Seed Users
    const admin = getOrCreateUser(
      'suporte@diretoriapromocoes.com.br',
      'Admin Diretoria',
      'administrator',
    )
    const ana = getOrCreateUser(
      'ana.books@diretoriapromocoes.com.br',
      'Ana Silva',
      'analista_books',
    )
    const bruno = getOrCreateUser(
      'bruno.books@diretoriapromocoes.com.br',
      'Bruno Costa',
      'analista_books',
    )
    const camila = getOrCreateUser(
      'camila.books@diretoriapromocoes.com.br',
      'Camila Rocha',
      'analista_books',
    )
    const sup1 = getOrCreateUser(
      'supervisor1@diretoriapromocoes.com.br',
      'Sérgio Supervisor',
      'supervisor',
    )
    const sup2 = getOrCreateUser(
      'supervisor2@diretoriapromocoes.com.br',
      'Sônia Supervisor',
      'supervisor',
    )
    const gestor = getOrCreateUser('gestor@diretoriapromocoes.com.br', 'Gabriel Gestor', 'gestor')

    const analystIds = [ana.id, bruno.id, camila.id]
    const supervisorIds = [sup1.id, sup2.id]

    // 2. Seed Stores (50 stores)
    const storeDataList = [
      {
        number: '0001',
        name: 'Pão de Açúcar Anália Franco',
        address: 'Av. Regente Feijó, 1739 - Tatuapé, São Paulo - SP',
        network: 'Pão de Açúcar',
        region: 'Sudeste',
      },
      {
        number: '0002',
        name: 'Extra Hiper Itaquera',
        address: 'Av. José Pinheiro Borges, s/n - Itaquera, São Paulo - SP',
        network: 'Extra',
        region: 'Sudeste',
      },
      {
        number: '0003',
        name: 'Carrefour Bairro Jardins',
        address: 'Alameda Santos, 880 - Cerqueira César, São Paulo - SP',
        network: 'Carrefour',
        region: 'Sudeste',
      },
      {
        number: '0004',
        name: 'Bompreço Boa Viagem',
        address: 'Av. Conselheiro Aguiar, 1500 - Boa Viagem, Recife - PE',
        network: 'Bompreço',
        region: 'Nordeste',
      },
      {
        number: '0005',
        name: 'Assaí Atacadista Santo Amaro',
        address: 'Av. das Nações Unidas, 21983 - Santo Amaro, São Paulo - SP',
        network: 'Assaí',
        region: 'Sudeste',
      },
      {
        number: '0006',
        name: 'Atacadão Perimetral Norte',
        address: 'Av. Perimetral Norte, 3800 - Goiânia - GO',
        network: 'Atacadão',
        region: 'Centro-Oeste',
      },
      {
        number: '0007',
        name: 'Guanabara Méier',
        address: 'Rua Arquias Cordeiro, 320 - Méier, Rio de Janeiro - RJ',
        network: 'Guanabara',
        region: 'Sudeste',
      },
      {
        number: '0008',
        name: 'Zona Sul Copacabana',
        address: 'Av. Nossa Sra. de Copacabana, 945 - Rio de Janeiro - RJ',
        network: 'Zona Sul',
        region: 'Sudeste',
      },
      {
        number: '0009',
        name: 'Oba Hortifruti Moema',
        address: 'Av. Ibirapuera, 3000 - Moema, São Paulo - SP',
        network: 'Oba Hortifruti',
        region: 'Sudeste',
      },
      {
        number: '0010',
        name: 'Hirota Food Ipiranga',
        address: 'Rua Silva Bueno, 1400 - Ipiranga, São Paulo - SP',
        network: 'Hirota Food',
        region: 'Sudeste',
      },
      {
        number: '0011',
        name: 'Dia Santa Cecília',
        address: 'Rua Santa Isabel, 120 - Santa Cecília, São Paulo - SP',
        network: 'Dia',
        region: 'Sudeste',
      },
      {
        number: '0012',
        name: 'Angeloni Florianópolis Beira Mar',
        address: "Av. Prof. Othon Gama d'Eça, 900 - Centro, Florianópolis - SC",
        network: 'Angeloni',
        region: 'Sul',
      },
      {
        number: '0013',
        name: 'Zaffari Higienópolis',
        address: 'Rua Cristóvão Colombo, 545 - Floresta, Porto Alegre - RS',
        network: 'Zaffari',
        region: 'Sul',
      },
      {
        number: '0014',
        name: 'Nacional Menino Deus',
        address: 'Av. Getúlio Vargas, 1200 - Menino Deus, Porto Alegre - RS',
        network: 'Nacional',
        region: 'Sul',
      },
      {
        number: '0015',
        name: 'Supermercado Mateus Cohama',
        address: 'Av. Daniel de La Touche, 2000 - Cohama, São Luís - MA',
        network: 'Grupo Mateus',
        region: 'Nordeste',
      },
      {
        number: '0016',
        name: 'GBarbosa Costa Azul',
        address: 'Rua Prof. Milton Santos, 400 - Costa Azul, Salvador - BA',
        network: 'GBarbosa',
        region: 'Nordeste',
      },
      {
        number: '0017',
        name: 'Comper Jardim dos Estados',
        address: 'Av. Mato Grosso, 2500 - Campo Grande - MS',
        network: 'Comper',
        region: 'Centro-Oeste',
      },
      {
        number: '0018',
        name: 'Supermercado DB Adrianópolis',
        address: 'Av. Mário Ypiranga, 1300 - Adrianópolis, Manaus - AM',
        network: 'DB Supermercados',
        region: 'Norte',
      },
      {
        number: '0019',
        name: 'Líder Batista Campos',
        address: 'Tv. Padre Eutíquio, 1800 - Batista Campos, Belém - PA',
        network: 'Grupo Líder',
        region: 'Norte',
      },
      {
        number: '0020',
        name: 'Supermercado Baratão da Carne',
        address: 'Av. Silves, 450 - Crespo, Manaus - AM',
        network: 'Baratão da Carne',
        region: 'Norte',
      },
      {
        number: '0021',
        name: 'Pão de Açúcar Batel',
        address: 'Av. Visconde de Guarapuava, 4200 - Batel, Curitiba - PR',
        network: 'Pão de Açúcar',
        region: 'Sul',
      },
      {
        number: '0022',
        name: 'Festval Água Verde',
        address: 'Av. Iguaçu, 2200 - Água Verde, Curitiba - PR',
        network: 'Festval',
        region: 'Sul',
      },
      {
        number: '0023',
        name: 'Condor Champagnat',
        address: 'Rua Martim Afonso, 2800 - Bigorrilho, Curitiba - PR',
        network: 'Condor',
        region: 'Sul',
      },
      {
        number: '0024',
        name: 'Super Muffato Portão',
        address: 'Rua Itacolomi, 500 - Portão, Curitiba - PR',
        network: 'Super Muffato',
        region: 'Sul',
      },
      {
        number: '0025',
        name: 'Mambo Vila Madalena',
        address: 'Rua Deputado Lacerda Franco, 400 - Pinheiros, São Paulo - SP',
        network: 'Mambo',
        region: 'Sudeste',
      },
      {
        number: '0026',
        name: 'Sonda Supermercados Lapa',
        address: 'Rua Clélia, 930 - Lapa, São Paulo - SP',
        network: 'Sonda',
        region: 'Sudeste',
      },
      {
        number: '0027',
        name: 'St Marche Alphaville',
        address: 'Alameda Araguaia, 750 - Alphaville, Barueri - SP',
        network: 'St Marche',
        region: 'Sudeste',
      },
      {
        number: '0028',
        name: 'Carrefour Hiper Barra da Tijuca',
        address: 'Av. das Américas, 5150 - Barra, Rio de Janeiro - RJ',
        network: 'Carrefour',
        region: 'Sudeste',
      },
      {
        number: '0029',
        name: 'Supermercados Mundial Tijuca',
        address: 'Rua Conde de Bonfim, 380 - Tijuca, Rio de Janeiro - RJ',
        network: 'Mundial',
        region: 'Sudeste',
      },
      {
        number: '0030',
        name: 'Super Doce Peixe',
        address: 'Av. Rui Barbosa, 1100 - Graças, Recife - PE',
        network: 'Doce Peixe',
        region: 'Nordeste',
      },
      {
        number: '0031',
        name: 'Carrefour Fortaleza Washington Soares',
        address: 'Av. Washington Soares, 4000 - Edson Queiroz, Fortaleza - CE',
        network: 'Carrefour',
        region: 'Nordeste',
      },
      {
        number: '0032',
        name: 'Pão de Açúcar Aldeota',
        address: 'Av. Santos Dumont, 3131 - Aldeota, Fortaleza - CE',
        network: 'Pão de Açúcar',
        region: 'Nordeste',
      },
      {
        number: '0033',
        name: 'Supermercado Nordestão Lagoa Nova',
        address: 'Av. Salgado Filho, 2200 - Lagoa Nova, Natal - RN',
        network: 'Nordestão',
        region: 'Nordeste',
      },
      {
        number: '0034',
        name: 'Supermercado Palato Farol',
        address: 'Av. Fernandes Lima, 1800 - Farol, Maceió - AL',
        network: 'Palato',
        region: 'Nordeste',
      },
      {
        number: '0035',
        name: 'Atacadão Várzea Grande',
        address: 'Av. FEB, 3000 - Várzea Grande - MT',
        network: 'Atacadão',
        region: 'Centro-Oeste',
      },
      {
        number: '0036',
        name: 'Big Box Asa Sul',
        address: 'CLS 408 Bloco A - Asa Sul, Brasília - DF',
        network: 'Big Box',
        region: 'Centro-Oeste',
      },
      {
        number: '0037',
        name: 'SuperAdega Ceilândia',
        address: 'CNN 1 Bloco F - Ceilândia, Brasília - DF',
        network: 'SuperAdega',
        region: 'Centro-Oeste',
      },
      {
        number: '0038',
        name: 'Supermercado Barchat Palmas',
        address: 'Quadra 104 Sul, Av. LO 3 - Centro, Palmas - TO',
        network: 'Barchat',
        region: 'Norte',
      },
      {
        number: '0039',
        name: 'Supermercado Formosa Umarizal',
        address: 'Av. Visconde de Souza Franco, 1000 - Belém - PA',
        network: 'Formosa',
        region: 'Norte',
      },
      {
        number: '0040',
        name: 'Atacadão Porto Velho',
        address: 'BR-364, km 2 - Porto Velho - RO',
        network: 'Atacadão',
        region: 'Norte',
      },
      {
        number: '0041',
        name: 'Verdemar Sion',
        address: 'Nossa Senhora do Carmo, 1900 - Sion, Belo Horizonte - MG',
        network: 'Verdemar',
        region: 'Sudeste',
      },
      {
        number: '0042',
        name: 'Supernosso Luxemburgo',
        address: 'Rua Guaicuí, 600 - Luxemburgo, Belo Horizonte - MG',
        network: 'Supernosso',
        region: 'Sudeste',
      },
      {
        number: '0043',
        name: 'Epa Plus Buritis',
        address: 'Av. Prof. Mário Werneck, 1200 - Buritis, Belo Horizonte - MG',
        network: 'Epa Plus',
        region: 'Sudeste',
      },
      {
        number: '0044',
        name: 'Supermercado BH Contagem',
        address: 'Av. João César de Oliveira, 2500 - Contagem - MG',
        network: 'Supermercados BH',
        region: 'Sudeste',
      },
      {
        number: '0045',
        name: 'Carrefour Hiper Uberlândia',
        address: 'Av. João Naves de Ávila, 1331 - Uberlândia - MG',
        network: 'Carrefour',
        region: 'Sudeste',
      },
      {
        number: '0046',
        name: 'Atacadão Vitória',
        address: 'Av. Fernando Ferrari, 2000 - Vitória - ES',
        network: 'Atacadão',
        region: 'Sudeste',
      },
      {
        number: '0047',
        name: 'Supermercado Carone Praia do Canto',
        address: 'Rua Joaquim Lírio, 450 - Vitória - ES',
        network: 'Carone',
        region: 'Sudeste',
      },
      {
        number: '0048',
        name: 'Pão de Açúcar Goiânia Bueno',
        address: 'Av. T-63, 1200 - Setor Bueno, Goiânia - GO',
        network: 'Pão de Açúcar',
        region: 'Centro-Oeste',
      },
      {
        number: '0049',
        name: 'Giassi Criciúma',
        address: 'Rua Marechal Deodoro, 400 - Centro, Criciúma - SC',
        network: 'Giassi',
        region: 'Sul',
      },
      {
        number: '0050',
        name: 'Koch Supermercados Itapema',
        address: 'Av. Nereu Ramos, 3500 - Meia Praia, Itapema - SC',
        network: 'Koch Supermercados',
        region: 'Sul',
      },
    ]

    const storeIds = []
    for (const st of storeDataList) {
      try {
        const existing = app.findFirstRecordByData('stores', 'number', st.number)
        storeIds.push(existing.id)
      } catch (_) {
        const rec = new Record(storesCol)
        rec.set('number', st.number)
        rec.set('name', st.name)
        rec.set('address', st.address)
        rec.set('network', st.network)
        rec.set('region', st.region)
        app.save(rec)
        storeIds.push(rec.id)
      }
    }

    // 3. Seed Brands (24 brands)
    const brandDataList = [
      {
        name: 'Café Santa Clara',
        frequency: 'diaria',
        analystIndex: 0,
        supervisorIndex: 0,
        stores: storeIds.slice(0, 15),
      },
      {
        name: 'Leite Mimosa',
        frequency: 'seg_qua_sex',
        analystIndex: 1,
        supervisorIndex: 0,
        stores: storeIds.slice(5, 20),
      },
      {
        name: 'Biscoitos Creme da Vovó',
        frequency: 'ter_qui_sab',
        analystIndex: 2,
        supervisorIndex: 1,
        stores: storeIds.slice(10, 25),
      },
      {
        name: 'Óleo da Horta',
        frequency: 'seg_qua_sex_sab',
        analystIndex: 0,
        supervisorIndex: 1,
        stores: storeIds.slice(15, 30),
      },
      {
        name: 'Arroz Fartura',
        frequency: 'diaria',
        analystIndex: 1,
        supervisorIndex: 0,
        stores: storeIds.slice(0, 20),
      },
      {
        name: 'Feijão Grão Nobre',
        frequency: 'seg_qua_sex',
        analystIndex: 2,
        supervisorIndex: 1,
        stores: storeIds.slice(5, 25),
      },
      {
        name: 'Massas Bela Itália',
        frequency: 'ter_qui_sab',
        analystIndex: 0,
        supervisorIndex: 0,
        stores: storeIds.slice(10, 30),
      },
      {
        name: 'Farinha Trigo Fino',
        frequency: 'seg_qua_sex_sab',
        analystIndex: 1,
        supervisorIndex: 1,
        stores: storeIds.slice(15, 35),
      },
      {
        name: 'Açúcar Doce Lua',
        frequency: 'diaria',
        analystIndex: 2,
        supervisorIndex: 0,
        stores: storeIds.slice(20, 40),
      },
      {
        name: 'Chá da Serra',
        frequency: 'seg_qua_sex',
        analystIndex: 0,
        supervisorIndex: 1,
        stores: storeIds.slice(25, 45),
      },
      {
        name: 'Suco Puro Sabor',
        frequency: 'ter_qui_sab',
        analystIndex: 1,
        supervisorIndex: 0,
        stores: storeIds.slice(30, 50),
      },
      {
        name: 'Água Mineral Cristalina',
        frequency: 'diaria',
        analystIndex: 2,
        supervisorIndex: 1,
        stores: storeIds.slice(0, 25),
      },
      {
        name: 'Refrigerante Efervescente',
        frequency: 'seg_qua_sex_sab',
        analystIndex: 0,
        supervisorIndex: 0,
        stores: storeIds.slice(5, 30),
      },
      {
        name: 'Cerveja Nobre Lager',
        frequency: 'diaria',
        analystIndex: 1,
        supervisorIndex: 1,
        stores: storeIds.slice(10, 35),
      },
      {
        name: 'Iogurte Natural Fresh',
        frequency: 'seg_qua_sex',
        analystIndex: 2,
        supervisorIndex: 0,
        stores: storeIds.slice(15, 40),
      },
      {
        name: 'Queijo Minas Artesanal',
        frequency: 'ter_qui_sab',
        analystIndex: 0,
        supervisorIndex: 1,
        stores: storeIds.slice(20, 45),
      },
      {
        name: 'Presunto Suave',
        frequency: 'seg_qua_sex_sab',
        analystIndex: 1,
        supervisorIndex: 0,
        stores: storeIds.slice(25, 50),
      },
      {
        name: 'Sardinha Mar Azul',
        frequency: 'seg_qua_sex',
        analystIndex: 2,
        supervisorIndex: 1,
        stores: storeIds.slice(0, 20),
      },
      {
        name: 'Molho de Tomate da Casa',
        frequency: 'diaria',
        analystIndex: 0,
        supervisorIndex: 0,
        stores: storeIds.slice(5, 25),
      },
      {
        name: 'Maionese Cremosa',
        frequency: 'ter_qui_sab',
        analystIndex: 1,
        supervisorIndex: 1,
        stores: storeIds.slice(10, 30),
      },
      {
        name: 'Sorvete Gelado Rei',
        frequency: 'seg_qua_sex_sab',
        analystIndex: 2,
        supervisorIndex: 0,
        stores: storeIds.slice(15, 35),
      },
      {
        name: 'Salgadinho Crocante',
        frequency: 'diaria',
        analystIndex: 0,
        supervisorIndex: 1,
        stores: storeIds.slice(20, 40),
      },
      {
        name: 'Chocolate Amargo 70%',
        frequency: 'seg_qua_sex',
        analystIndex: 1,
        supervisorIndex: 0,
        stores: storeIds.slice(25, 45),
      },
      {
        name: 'Granola Energia Puríssima',
        frequency: 'ter_qui_sab',
        analystIndex: 2,
        supervisorIndex: 1,
        stores: storeIds.slice(30, 50),
      },
    ]

    const brandRecords = {}
    for (const bd of brandDataList) {
      try {
        const existing = app.findFirstRecordByData('brands', 'name', bd.name)
        brandRecords[bd.name] = existing
      } catch (_) {
        const rec = new Record(brandsCol)
        rec.set('name', bd.name)
        rec.set('frequency', bd.frequency)
        rec.set('stores', bd.stores)
        rec.set('analysts', [analystIds[bd.analystIndex]])
        rec.set('supervisors', [supervisorIds[bd.supervisorIndex]])
        app.save(rec)
        brandRecords[bd.name] = rec
      }
    }

    // 4. Seed SKUs (40+ items)
    const skuDataList = [
      {
        code: 'SKU-CSC-001',
        name: 'Café Santa Clara Moído Tradicional 500g',
        brandName: 'Café Santa Clara',
        normal_price: 18.9,
        promo_price: 14.9,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 4,
        requires_splash: true,
      },
      {
        code: 'SKU-CSC-002',
        name: 'Café Santa Clara Extra Forte 500g',
        brandName: 'Café Santa Clara',
        normal_price: 19.5,
        promo_price: null,
        main_gondola: true,
        min_quantity: 3,
        requires_splash: false,
      },
      {
        code: 'SKU-CSC-003',
        name: 'Café Santa Clara Solúvel 100g',
        brandName: 'Café Santa Clara',
        normal_price: 12.0,
        promo_price: 9.9,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: false,
        min_quantity: 2,
        requires_splash: true,
      },

      {
        code: 'SKU-MIM-001',
        name: 'Leite Mimosa Integral 1L',
        brandName: 'Leite Mimosa',
        normal_price: 5.49,
        promo_price: 4.29,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 12,
        requires_splash: true,
      },
      {
        code: 'SKU-MIM-002',
        name: 'Leite Mimosa Desnatado 1L',
        brandName: 'Leite Mimosa',
        normal_price: 5.49,
        promo_price: null,
        main_gondola: true,
        min_quantity: 8,
        requires_splash: false,
      },
      {
        code: 'SKU-MIM-003',
        name: 'Leite Mimosa Sem Lactose 1L',
        brandName: 'Leite Mimosa',
        normal_price: 6.8,
        promo_price: null,
        main_gondola: false,
        min_quantity: 4,
        requires_splash: false,
      },

      {
        code: 'SKU-VOV-001',
        name: 'Biscoito Cream Cracker Vovó 400g',
        brandName: 'Biscoitos Creme da Vovó',
        normal_price: 6.9,
        promo_price: 4.99,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 6,
        requires_splash: true,
      },
      {
        code: 'SKU-VOV-002',
        name: 'Biscoito Recheado Chocolate Vovó 140g',
        brandName: 'Biscoitos Creme da Vovó',
        normal_price: 3.5,
        promo_price: null,
        main_gondola: true,
        min_quantity: 10,
        requires_splash: false,
      },
      {
        code: 'SKU-VOV-003',
        name: 'Biscoito Maria Vovó 350g',
        brandName: 'Biscoitos Creme da Vovó',
        normal_price: 5.8,
        promo_price: null,
        main_gondola: true,
        min_quantity: 5,
        requires_splash: false,
      },

      {
        code: 'SKU-HOR-001',
        name: 'Óleo de Soja Horta 900ml',
        brandName: 'Óleo da Horta',
        normal_price: 7.9,
        promo_price: 6.49,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 15,
        requires_splash: true,
      },
      {
        code: 'SKU-HOR-002',
        name: 'Azeite de Oliva Extra Virgem Horta 500ml',
        brandName: 'Óleo da Horta',
        normal_price: 38.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 3,
        requires_splash: false,
      },

      {
        code: 'SKU-FAR-001',
        name: 'Arroz Fartura Tipo 1 5kg',
        brandName: 'Arroz Fartura',
        normal_price: 29.9,
        promo_price: 24.9,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 10,
        requires_splash: true,
      },
      {
        code: 'SKU-FAR-002',
        name: 'Arroz Fartura Integral 1kg',
        brandName: 'Arroz Fartura',
        normal_price: 8.5,
        promo_price: null,
        main_gondola: false,
        min_quantity: 4,
        requires_splash: false,
      },

      {
        code: 'SKU-GRA-001',
        name: 'Feijão Carioca Grão Nobre 1kg',
        brandName: 'Feijão Grão Nobre',
        normal_price: 8.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 8,
        requires_splash: false,
      },
      {
        code: 'SKU-GRA-002',
        name: 'Feijão Preto Grão Nobre 1kg',
        brandName: 'Feijão Grão Nobre',
        normal_price: 9.2,
        promo_price: 7.8,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 6,
        requires_splash: true,
      },

      {
        code: 'SKU-BEL-001',
        name: 'Massa Espaguete Bela Itália 500g',
        brandName: 'Massas Bela Itália',
        normal_price: 4.8,
        promo_price: null,
        main_gondola: true,
        min_quantity: 10,
        requires_splash: false,
      },
      {
        code: 'SKU-BEL-002',
        name: 'Massa Penne Bela Itália 500g',
        brandName: 'Massas Bela Itália',
        normal_price: 4.8,
        promo_price: 3.69,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 8,
        requires_splash: true,
      },

      {
        code: 'SKU-TRI-001',
        name: 'Farinha de Trigo Fino Tipo 1 1kg',
        brandName: 'Farinha Trigo Fino',
        normal_price: 5.2,
        promo_price: null,
        main_gondola: true,
        min_quantity: 6,
        requires_splash: false,
      },
      {
        code: 'SKU-LUA-001',
        name: 'Açúcar Refinado Doce Lua 1kg',
        brandName: 'Açúcar Doce Lua',
        normal_price: 4.5,
        promo_price: 3.89,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 12,
        requires_splash: true,
      },

      {
        code: 'SKU-SER-001',
        name: 'Chá Mate da Serra Caixa c/ 25 saquinhos',
        brandName: 'Chá da Serra',
        normal_price: 6.5,
        promo_price: null,
        main_gondola: false,
        min_quantity: 3,
        requires_splash: false,
      },
      {
        code: 'SKU-PUR-001',
        name: 'Suco Puro Sabor Uva 1L',
        brandName: 'Suco Puro Sabor',
        normal_price: 9.9,
        promo_price: 7.9,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 5,
        requires_splash: true,
      },
      {
        code: 'SKU-CRI-001',
        name: 'Água Mineral Cristalina Sem Gás 500ml',
        brandName: 'Água Mineral Cristalina',
        normal_price: 2.2,
        promo_price: null,
        main_gondola: true,
        min_quantity: 20,
        requires_splash: false,
      },
      {
        code: 'SKU-EFE-001',
        name: 'Refrigerante Efervescente Guaraná 2L',
        brandName: 'Refrigerante Efervescente',
        normal_price: 7.5,
        promo_price: 5.99,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 10,
        requires_splash: true,
      },
      {
        code: 'SKU-LAG-001',
        name: 'Cerveja Nobre Lager Lata 350ml',
        brandName: 'Cerveja Nobre Lager',
        normal_price: 4.2,
        promo_price: 3.29,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 24,
        requires_splash: true,
      },
      {
        code: 'SKU-FRE-001',
        name: 'Iogurte Natural Fresh Morango 170g',
        brandName: 'Iogurte Natural Fresh',
        normal_price: 3.8,
        promo_price: null,
        main_gondola: true,
        min_quantity: 8,
        requires_splash: false,
      },
      {
        code: 'SKU-QUE-001',
        name: 'Queijo Minas Artesanal 500g',
        brandName: 'Queijo Minas Artesanal',
        normal_price: 28.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 3,
        requires_splash: false,
      },
      {
        code: 'SKU-PRE-001',
        name: 'Presunto Suave Fatiado 200g',
        brandName: 'Presunto Suave',
        normal_price: 11.5,
        promo_price: 9.2,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 5,
        requires_splash: true,
      },
      {
        code: 'SKU-MAR-001',
        name: 'Sardinha Mar Azul em Óleo 125g',
        brandName: 'Sardinha Mar Azul',
        normal_price: 5.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 10,
        requires_splash: false,
      },
      {
        code: 'SKU-CAS-001',
        name: 'Molho de Tomate da Casa Tradicional 340g',
        brandName: 'Molho de Tomate da Casa',
        normal_price: 3.2,
        promo_price: null,
        main_gondola: true,
        min_quantity: 12,
        requires_splash: false,
      },
      {
        code: 'SKU-MAI-001',
        name: 'Maionese Cremosa Tradicional 500g',
        brandName: 'Maionese Cremosa',
        normal_price: 8.9,
        promo_price: 6.9,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 6,
        requires_splash: true,
      },
      {
        code: 'SKU-SOR-001',
        name: 'Sorvete Gelado Rei Creme 1.5L',
        brandName: 'Sorvete Gelado Rei',
        normal_price: 24.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 2,
        requires_splash: false,
      },
      {
        code: 'SKU-CRO-001',
        name: 'Salgadinho Crocante Queijo 100g',
        brandName: 'Salgadinho Crocante',
        normal_price: 4.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 10,
        requires_splash: false,
      },
      {
        code: 'SKU-CHO-001',
        name: 'Chocolate Amargo 70% Cacau 80g',
        brandName: 'Chocolate Amargo 70%',
        normal_price: 9.5,
        promo_price: 7.5,
        promo_start: '2025-01-01',
        promo_end: '2025-12-31',
        main_gondola: true,
        min_quantity: 8,
        requires_splash: true,
      },
      {
        code: 'SKU-PUR-002',
        name: 'Granola Energia Puríssima Tradicional 500g',
        brandName: 'Granola Energia Puríssima',
        normal_price: 16.9,
        promo_price: null,
        main_gondola: true,
        min_quantity: 4,
        requires_splash: false,
      },
    ]

    for (const sk of skuDataList) {
      const brandRec = brandRecords[sk.brandName]
      if (!brandRec) continue
      try {
        app.findFirstRecordByData('skus', 'code', sk.code)
      } catch (_) {
        const rec = new Record(skusCol)
        rec.set('code', sk.code)
        rec.set('name', sk.name)
        rec.set('brand', brandRec.id)
        rec.set('normal_price', sk.normal_price)
        if (sk.promo_price) rec.set('promo_price', sk.promo_price)
        if (sk.promo_start) rec.set('promo_start', sk.promo_start)
        if (sk.promo_end) rec.set('promo_end', sk.promo_end)
        rec.set('main_gondola', sk.main_gondola !== undefined ? sk.main_gondola : true)
        rec.set('min_quantity', sk.min_quantity || 1)
        rec.set('requires_splash', sk.requires_splash || false)
        app.save(rec)
      }
    }

    // 5. Seed Promoters (8 promoters)
    const promoterList = [
      {
        name: 'Carlos Eduardo Santos',
        phone: '(11) 98765-4321',
        brandNames: ['Café Santa Clara', 'Arroz Fartura'],
        storeSlice: [0, 8],
      },
      {
        name: 'Juliana Maria de Oliveira',
        phone: '(11) 99876-5432',
        brandNames: ['Leite Mimosa', 'Iogurte Natural Fresh'],
        storeSlice: [5, 12],
      },
      {
        name: 'Roberto Ferreira Lima',
        phone: '(21) 97654-3210',
        brandNames: ['Guanabara Méier', 'Óleo da Horta', 'Sardinha Mar Azul'],
        storeSlice: [6, 14],
      },
      {
        name: 'Fernanda Cristina Alves',
        phone: '(31) 98123-4567',
        brandNames: ['Biscoitos Creme da Vovó', 'Feijão Grão Nobre'],
        storeSlice: [10, 18],
      },
      {
        name: 'Lucas Henrique Souza',
        phone: '(41) 99123-8877',
        brandNames: ['Água Mineral Cristalina', 'Cerveja Nobre Lager'],
        storeSlice: [12, 22],
      },
      {
        name: 'Patrícia Barbosa Mendes',
        phone: '(81) 98877-6655',
        brandNames: ['Suco Puro Sabor', 'Maionese Cremosa'],
        storeSlice: [15, 25],
      },
      {
        name: 'Thiago Rodrigues Paz',
        phone: '(71) 99223-1144',
        brandNames: ['Refrigerante Efervescente', 'Chocolate Amargo 70%'],
        storeSlice: [20, 30],
      },
      {
        name: 'Vanessa Martins Ramos',
        phone: '(61) 98334-5566',
        brandNames: ['Açúcar Doce Lua', 'Massas Bela Itália'],
        storeSlice: [25, 35],
      },
    ]

    for (const pm of promoterList) {
      try {
        app.findFirstRecordByData('promoters', 'name', pm.name)
      } catch (_) {
        const bIds = pm.brandNames
          .map((n) => (brandRecords[n] ? brandRecords[n].id : null))
          .filter(Boolean)
        const sIds = storeIds.slice(pm.storeSlice[0], pm.storeSlice[1])
        const rec = new Record(promotersCol)
        rec.set('name', pm.name)
        rec.set('phone', pm.phone)
        rec.set('brands', bIds)
        rec.set('stores', sIds)
        app.save(rec)
      }
    }

    // 6. Seed Audit Rules
    const auditRulesList = [
      {
        brandName: 'Café Santa Clara',
        title: 'Exposição Primária em Gôndola Principal',
        criteria:
          'A marca Café Santa Clara deve ocupar no mínimo 4 frentes na 2ª ou 3ª prateleira (altura dos olhos) da gôndola de matinais. Bloco de marca obrigatório.',
        mandatory_layout: 'Bloco vertical 2ª/3ª prateleira',
        requires_splash: true,
        min_facings: 4,
      },
      {
        brandName: 'Leite Mimosa',
        title: 'Ponto Extra / Ilha de Laticínios',
        criteria:
          'Sempre que em promoção, posicionar ilha ou ponta de gôndola próxima à entrada dos frios. Preço promocional visível.',
        mandatory_layout: 'Ponta de gôndola focado em oferta',
        requires_splash: true,
        min_facings: 12,
      },
      {
        brandName: 'Biscoitos Creme da Vovó',
        title: 'Gôndola de Biscoitos e Matinais',
        criteria:
          'Organizar por categoria: salgados na prateleira superior, recheados no meio e doces simples na parte inferior.',
        mandatory_layout: 'Organização por subcategoria horizontal',
        requires_splash: false,
        min_facings: 6,
      },
      {
        brandName: 'Óleo da Horta',
        title: 'Seção de Mercearia Doce e Salgada',
        criteria:
          'Óleo em garrafa PET deve estar com frentes organizadas por tipo (soja, girassol, azeite). Proibido caixa de papelão rasgada.',
        mandatory_layout: 'Caixa display de papelão padronizada',
        requires_splash: true,
        min_facings: 8,
      },
      {
        brandName: 'Arroz Fartura',
        title: 'Palete de Chão e Ponto de Massa',
        criteria:
          'Sacos de 5kg em fardo estruturado ou palete de madeira revestido com forração da marca. Faixa de gôndola instalada.',
        mandatory_layout: 'Palete forrado 1,20m altura max',
        requires_splash: true,
        min_facings: 10,
      },
      {
        brandName: 'Cerveja Nobre Lager',
        title: 'Geladeira Exclusiva e Ponto Frio',
        criteria:
          'Geladeiras e coolers da marca abastecidos a no mínimo 80% da capacidade durante sextas e sábados.',
        mandatory_layout: 'Cooler / Geladeira envelopada',
        requires_splash: true,
        min_facings: 15,
      },
      {
        brandName: 'Açúcar Doce Lua',
        title: 'Massa de Mercearia Básica',
        criteria:
          'Exposição ao lado do café e chás. Frentes limpas e sem fardos rasgados. Placa promocional de preço se houver desconto.',
        mandatory_layout: 'Gôndola de mercearia seca',
        requires_splash: true,
        min_facings: 8,
      },
    ]

    for (const ar of auditRulesList) {
      const bRec = brandRecords[ar.brandName]
      if (!bRec) continue
      try {
        app.findFirstRecordByData('audit_rules', 'title', ar.title)
      } catch (_) {
        const rec = new Record(rulesCol)
        rec.set('brand', bRec.id)
        rec.set('title', ar.title)
        rec.set('criteria', ar.criteria)
        rec.set('mandatory_layout', ar.mandatory_layout)
        rec.set('requires_splash', ar.requires_splash)
        rec.set('min_facings', ar.min_facings)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
  },
)
